import crypto from 'node:crypto'
import { TtsError, ELEVENLABS, isElevenLabsEnabled } from '@/providers/elevenlabs'
import { CLAIM_PENDING_JOBS, GET_JOB, MARK_JOB_STATE } from '@/providers/outbox-job'
import { CREATE_PENDING_ASSET, DELETE_ASSET, MARK_READY_CHURCH_LESS } from '@/providers/media'
import { S3_DELETE_OBJECT, S3_PUT_OBJECT } from '@/providers/s3'
import { GET_GENERAL_PRAYER_BY_ID, SET_GENERAL_PRAYER_AUDIO } from '@/providers/general-prayer'
import { AUDIO_MAX_ATTEMPTS } from '@/config/general-prayer'
import { GeneralError } from '@/utils/general-error'
import { hashBytes } from '@/utils/hash'
import { richTextToPlainText } from '@/utils/rich-text-plain'
import { logger } from '@/utils/logger'

/*
 * general_prayer.audio job (GP-JOB-A-02…05).
 *
 * Trusted worker: re-reads the prayer, then TTS (one platform voice from env)
 * → public S3 object → a CHURCH-LESS MediaAsset → `audio_status = READY`.
 *
 * Idempotency: a replay after success finds READY and stops; `GENERATING` is
 * entered through a conditional write, so two workers cannot both synthesize.
 * Failures are visible: a permanent error or a spent retry budget finalizes
 * both the row and the job with an error code — never a silent skip.
 */

/** ElevenLabs accepts 10 000 characters per request; leave headroom for the SSML-free plain text. */
const MAX_TEXT_CHARS = 9_500

const backoff = (attempts: number) => new Date(Date.now() + 30_000 * 2 ** attempts)

export type JobOutcome = 'succeeded' | 'failed' | 'requeued' | 'skipped'

/** The narration text: the introduction (when present) then the prayer body. */
export const generalPrayerSpeechText = ({
  introduction,
  body,
}: {
  introduction: string | null
  body: string
}) =>
  [introduction ? richTextToPlainText(introduction) : '', richTextToPlainText(body)]
    .filter((part) => part.length > 0)
    .join('\n\n')
    .slice(0, MAX_TEXT_CHARS)

/** Best-effort removal of a superseded asset; never fails the job. */
const discardPreviousAudio = async (
  previous: {
    assetId: string
    objectKey: string
  } | null,
): Promise<void> => {
  if (!previous) return
  try {
    await S3_DELETE_OBJECT({ key: previous.objectKey })
  } catch {
    // Object already gone (or storage unavailable) — the row is the source of truth.
  }
  try {
    await DELETE_ASSET({ assetId: previous.assetId })
  } catch {
    // Asset already deleted; the unique pointer moved away from it already.
  }
}

export const processGeneralPrayerAudioJob = async (
  jobId: string,
  _requestId: string,
): Promise<JobOutcome> => {
  const job = await GET_JOB({ jobId })
  if (!job || job.state !== 'RUNNING') return 'skipped'
  const generalPrayerId = job.resource_id
  if (!generalPrayerId) {
    await MARK_JOB_STATE({ jobId, state: 'FAILED', errorCode: 'MISSING_RESOURCE' })
    return 'failed'
  }

  const prayer = await GET_GENERAL_PRAYER_BY_ID({ generalPrayerId })
  if (!prayer) {
    // Deleted while queued — nothing to synthesize.
    await MARK_JOB_STATE({ jobId, state: 'SUCCEEDED' })
    return 'succeeded'
  }
  if (prayer.audio_status === 'READY' && prayer.audio_asset_id) {
    // Duplicate delivery / crash-after-finalize replay: already done.
    await MARK_JOB_STATE({ jobId, state: 'SUCCEEDED' })
    return 'succeeded'
  }
  if (!prayer.is_active) {
    logger.info('general_prayer_audio_skipped_inactive', {
      job_id: jobId,
      general_prayer_id: generalPrayerId,
    })
    await MARK_JOB_STATE({ jobId, state: 'SUCCEEDED', errorCode: 'PRAYER_INACTIVE' })
    return 'succeeded'
  }

  const voiceId = process.env.ELEVENLABS_GENERAL_PRAYER_VOICE_ID?.trim()
  const fail = async (errorCode: string): Promise<JobOutcome> => {
    await SET_GENERAL_PRAYER_AUDIO({
      generalPrayerId,
      status: 'FAILED',
      errorCode,
      assetId: prayer.audio_asset_id,
    })
    await MARK_JOB_STATE({ jobId, state: 'FAILED', errorCode })
    return 'failed'
  }

  // Configuration is not retryable: the voice id is an ops item (GP-OPS-03).
  if (!isElevenLabsEnabled()) return fail('TTS_NOT_CONFIGURED')
  if (!voiceId) return fail('TTS_NOT_CONFIGURED')

  const text = generalPrayerSpeechText({
    introduction: prayer.introduction,
    body: prayer.body,
  })
  if (text.length === 0) return fail('TEXT_EMPTY')

  const started = await SET_GENERAL_PRAYER_AUDIO({ generalPrayerId, status: 'GENERATING' })
  if (started.count === 0) return 'skipped' // another worker is synthesizing this prayer

  const previous =
    prayer.audio_asset_id && prayer.audio_asset
      ? { assetId: prayer.audio_asset_id, objectKey: prayer.audio_asset.object_key }
      : null

  try {
    const speech = await ELEVENLABS.generateSpeech({
      providerVoiceId: voiceId,
      text,
      languageCode: prayer.language_code,
    })
    const objectKey = `media/general_prayer/generated_audio/${crypto.randomUUID()}`
    await S3_PUT_OBJECT({ key: objectKey, body: speech.bytes, contentType: speech.contentType })
    const checksum = hashBytes(speech.bytes)
    const asset = await CREATE_PENDING_ASSET({
      churchId: null,
      purpose: 'GENERATED_AUDIO',
      mimeType: speech.contentType,
      byteSize: speech.bytes.byteLength,
      objectKey,
      uploadedBy: null,
    })
    await MARK_READY_CHURCH_LESS({ assetId: asset.id, checksum })
    await SET_GENERAL_PRAYER_AUDIO({
      generalPrayerId,
      status: 'READY',
      assetId: asset.id,
      providerRequestId: speech.providerRequestId,
      generatedAt: new Date(),
      errorCode: null,
    })
    if (previous && previous.assetId !== asset.id) await discardPreviousAudio(previous)
    await MARK_JOB_STATE({ jobId, state: 'SUCCEEDED' })
    return 'succeeded'
  } catch (err) {
    // `error_message`, not `message`: the logger redacts a field named `message`.
    logger.error('general_prayer_audio_job_error', {
      job_id: jobId,
      general_prayer_id: generalPrayerId,
      error_code: err instanceof TtsError ? err.errorCode : 'INTERNAL_JOB_ERROR',
      error_name: err instanceof Error ? err.name : typeof err,
      error_message: err instanceof Error ? err.message : String(err),
    })

    // A misconfigured runtime (missing bucket, missing key) is not transient:
    // retrying it burns the budget and hides the cause behind a generic code.
    const errorCode =
      err instanceof TtsError
        ? err.errorCode
        : err instanceof GeneralError
          ? err.error_code
          : 'INTERNAL_JOB_ERROR'
    const misconfigured = err instanceof GeneralError && err.error_code.endsWith('NOT_CONFIGURED')
    const retryable = misconfigured ? false : !(err instanceof TtsError) || err.retryable
    if (!retryable || job.attempts >= AUDIO_MAX_ATTEMPTS) return fail(errorCode)

    // Retry: the row goes back to QUEUED so the UI does not sit on GENERATING.
    await SET_GENERAL_PRAYER_AUDIO({ generalPrayerId, status: 'QUEUED', errorCode })
    await MARK_JOB_STATE({
      jobId,
      state: 'PENDING',
      errorCode,
      availableAt: backoff(job.attempts),
    })
    return 'requeued'
  }
}

/** One polling tick over the general_prayer.audio queue. */
export const runGeneralPrayerAudioTick = async ({ limit = 5 }: { limit?: number } = {}) => {
  const claimed = await CLAIM_PENDING_JOBS({ kind: 'general_prayer.audio', limit })
  const summary = { claimed: claimed.length, succeeded: 0, failed: 0, requeued: 0, skipped: 0 }
  for (const job of claimed) {
    try {
      summary[await processGeneralPrayerAudioJob(job.id, crypto.randomUUID())]++
    } catch {
      // Last resort: the processor funnels expected failures; this guards the
      // claim-mapping/infra path of a single job.
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
