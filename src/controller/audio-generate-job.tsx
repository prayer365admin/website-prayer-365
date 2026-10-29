import { TtsError, ELEVENLABS, isElevenLabsEnabled } from '@/providers/elevenlabs'
import { CLAIM_PENDING_JOBS, GET_JOB, MARK_JOB_STATE } from '@/providers/outbox-job'
import { logger } from '@/utils/logger'
import {
  GET_AUDIO_FOR_JOB,
  SET_AUDIO_GENERATING,
  RESET_AUDIO_QUEUED,
  FINALIZE_AUDIO_READY,
  FINALIZE_AUDIO_FAILED,
  FINALIZE_AUDIO_VOICE_MISSING,
} from '@/providers/prayer-audio'
import { S3_PUT_OBJECT, S3_DELETE_OBJECT } from '@/providers/s3'
import { CREATE_PENDING_ASSET, MARK_READY, DELETE_ASSET } from '@/providers/media'
import { hashBytes } from '@/utils/hash'
import { richTextToPlainText } from '@/utils/rich-text-plain'

/*
 * audio.generate job (PR-07). Trusted worker: re-proves every business fact
 * the enqueue boundary checked at enqueue time (approval, current snapshot,
 * voice readiness, consent, tenancy), then ElevenLabs TTS → private S3 →
 * MediaAsset READY → PrayerAudio READY. Transient failures requeue with
 * backoff; permanent ones finalize FAILED. Every db write lives in a provider
 * (SPEC layer rule) — this file only decides, never touches Prisma.
 */

const MAX_ATTEMPTS_RAW = Number(process.env.AUDIO_GENERATE_MAX_ATTEMPTS ?? 3)
const MAX_ATTEMPTS =
  Number.isFinite(MAX_ATTEMPTS_RAW) && MAX_ATTEMPTS_RAW >= 1 ? MAX_ATTEMPTS_RAW : 3

// 30s, 60s, 120s… per attempt number.
const backoff = (attempts: number) => new Date(Date.now() + 30_000 * 2 ** attempts)

type JobOutcome = 'succeeded' | 'failed' | 'requeued' | 'skipped'

/** Backoff requeue until MAX_ATTEMPTS, then permanent failure. */
const requeueOrFail = async (
  job: { id: string; attempts: number },
  audio: { id: string; verse: { prayer: { church_id: string } } },
  err: { errorCode: string },
  requestId: string,
): Promise<JobOutcome> => {
  if (job.attempts >= MAX_ATTEMPTS) {
    await FINALIZE_AUDIO_FAILED({
      audioId: audio.id,
      churchId: audio.verse.prayer.church_id,
      errorCode: err.errorCode,
      requestId,
    })
    await MARK_JOB_STATE({ jobId: job.id, state: 'FAILED', errorCode: err.errorCode })
    return 'failed'
  }
  await RESET_AUDIO_QUEUED({ audioId: audio.id })
  await MARK_JOB_STATE({
    jobId: job.id,
    state: 'PENDING',
    errorCode: err.errorCode,
    availableAt: backoff(job.attempts),
  })
  return 'requeued'
}

export const processAudioGenerateJob = async (
  jobId: string,
  requestId: string,
): Promise<JobOutcome> => {
  const job = await GET_JOB({ jobId })
  if (!job || job.state !== 'RUNNING') return 'skipped'
  const audioId = job.resource_id
  if (!audioId) return 'skipped'
  const payload = (job.payload ?? null) as { textHash?: string } | null
  const resource = await GET_AUDIO_FOR_JOB({ audioId })
  if (!resource) {
    // Resource deleted while queued — nothing to generate.
    await MARK_JOB_STATE({ jobId, state: 'SUCCEEDED' })
    return 'succeeded'
  }
  const churchId = resource.verse.prayer.church_id
  if (resource.status === 'READY' || resource.status === 'APPROVED') {
    // Duplicate delivery / crash-after-finalize replay: already done.
    await MARK_JOB_STATE({ jobId, state: 'SUCCEEDED' })
    return 'succeeded'
  }

  const fail = async (errorCode: string): Promise<JobOutcome> => {
    await FINALIZE_AUDIO_FAILED({ audioId: resource.id, churchId, errorCode, requestId })
    await MARK_JOB_STATE({ jobId, state: 'FAILED', errorCode })
    return 'failed'
  }

  // Guard clauses: enqueue guarantees these; the worker re-proves each one.
  if (resource.voice_profile.church_id !== churchId) {
    return fail('VOICE_WRONG_CHURCH')
  }
  if (!resource.verse.approved_at) return fail('TEXT_NOT_APPROVED')
  if (resource.verse.prayer.current_version_id !== resource.verse.id) return fail('STALE_SNAPSHOT')
  if (payload?.textHash && payload.textHash !== resource.verse.text_hash)
    return fail('STALE_SNAPSHOT')
  if (
    resource.voice_profile.review_state !== 'APPROVED' ||
    resource.voice_profile.registration_state !== 'READY'
  ) {
    return fail('VOICE_NOT_READY')
  }
  if (resource.voice_profile.consent?.revoked_at) return fail('VOICE_CONSENT_REVOKED')
  if (!resource.voice_profile.provider_voice_id) return fail('VOICE_UNREGISTERED')
  if (!isElevenLabsEnabled()) return fail('ELEVENLABS_DISABLED')

  const started = await SET_AUDIO_GENERATING({ audioId: resource.id })
  if (started.count === 0) return 'skipped' // another worker finalized it

  const audio = { id: resource.id, verse: { prayer: { church_id: churchId } } }
  try {
    const speech = await ELEVENLABS.generateSpeech({
      providerVoiceId: resource.voice_profile.provider_voice_id,
      text: richTextToPlainText(resource.verse.body),
      languageCode: resource.verse.language_code,
    })
    const objectKey = `media/${churchId}/generated_audio/${crypto.randomUUID()}`
    await S3_PUT_OBJECT({ key: objectKey, body: speech.bytes, contentType: speech.contentType })
    const checksum = hashBytes(speech.bytes)
    const asset = await CREATE_PENDING_ASSET({
      churchId,
      purpose: 'GENERATED_AUDIO',
      mimeType: speech.contentType,
      byteSize: speech.bytes.byteLength,
      objectKey,
      uploadedBy: null,
    })
    await MARK_READY({ churchIds: new Set([churchId]), assetId: asset.id, checksum })
    const done = await FINALIZE_AUDIO_READY({
      audioId: resource.id,
      churchId,
      assetId: asset.id,
      providerRequestId: speech.providerRequestId,
      requestId,
    })
    if (done.count === 0) {
      // Lost the finalize race (audio finalized/approved elsewhere): roll back the asset.
      await DELETE_ASSET({ assetId: asset.id })
      await S3_DELETE_OBJECT({ key: objectKey })
      await MARK_JOB_STATE({ jobId, state: 'SUCCEEDED' })
      return 'succeeded'
    }
    await MARK_JOB_STATE({ jobId, state: 'SUCCEEDED' })
    return 'succeeded'
  } catch (err) {
    // Transient TTS + any infra hiccup (S3 put, asset create, finalize) share the
    // retryable path; a retry re-proves the guards, so re-entry stays idempotent.
    //
    // Logged with `error_message` on purpose: a field literally named `message`
    // is redacted by the logger (it guards private request bodies), which would
    // hide the only clue about an unexpected failure.
    logger.error('audio_generate_job_error', {
      job_id: jobId,
      audio_id: resource.id,
      error_code: err instanceof TtsError ? err.errorCode : 'INTERNAL_JOB_ERROR',
      error_name: err instanceof Error ? err.name : typeof err,
      error_message: err instanceof Error ? err.message : String(err),
    })
    if (err instanceof TtsError && err.errorCode === 'TTS_VOICE_NOT_FOUND') {
      // Clone gone at ElevenLabs: flag the voice for a manual re-create (F4VO V8).
      await FINALIZE_AUDIO_VOICE_MISSING({
        audioId: resource.id,
        voiceProfileId: resource.voice_profile.id,
        churchId,
        requestId,
      })
      await MARK_JOB_STATE({ jobId, state: 'FAILED', errorCode: 'VOICE_MISSING_AT_PROVIDER' })
      return 'failed'
    }
    if (err instanceof TtsError && !err.retryable) {
      await FINALIZE_AUDIO_FAILED({
        audioId: resource.id,
        churchId,
        errorCode: err.errorCode,
        requestId,
      })
      await MARK_JOB_STATE({ jobId, state: 'FAILED', errorCode: err.errorCode })
      return 'failed'
    }
    return requeueOrFail(
      job,
      audio,
      err instanceof TtsError ? err : { errorCode: 'INTERNAL_JOB_ERROR' },
      requestId,
    )
  }
}

/** One polling tick over the audio.generate queue; per-job try/catch isolates crashes. */
export const runAudioGenerateTick = async ({ limit = 5 }: { limit?: number } = {}) => {
  const claimed = await CLAIM_PENDING_JOBS({ kind: 'audio.generate', limit })
  const summary = { claimed: claimed.length, succeeded: 0, failed: 0, requeued: 0, skipped: 0 }
  for (const job of claimed) {
    try {
      const outcome = await processAudioGenerateJob(job.id, crypto.randomUUID())
      summary[outcome]++
    } catch {
      // Last resort: processAudioGenerateJob already funnels expected failures;
      // this catch only guards the claim-mapping/infra path of one job.
      summary.skipped++
      await MARK_JOB_STATE({
        jobId: job.id,
        state: 'PENDING',
        errorCode: 'INTERNAL_JOB_ERROR',
        availableAt: backoff(0),
      }).catch(() => undefined)
    }
  }
  return summary
}
