import { ELEVENLABS, VoiceProviderError, isElevenLabsEnabled } from '@/providers/elevenlabs'
import { CLAIM_PENDING_JOBS, GET_JOB, MARK_JOB_STATE } from '@/providers/outbox-job'
import { S3_GET_OBJECT_BYTES } from '@/providers/s3'
import {
  AUDIT_REGISTRATION_DISCARDED,
  FINALIZE_REGISTRATION_FAILED,
  FINALIZE_REGISTRATION_READY,
  GET_PROFILE_FOR_JOB,
  SET_REGISTERING,
  SET_REGISTRATION_STATE,
  STORE_PROVIDER_VOICE,
  VoiceProfileForJob,
} from '@/providers/voice'
import { hashBytes } from '@/utils/hash'
import { logger } from '@/utils/logger'

/*
 * voice.register job (F4VO VO-07, SPEC 9.3.1). Trusted worker: re-proves what
 * approval checked (approved, consent, samples, tenancy), verifies every sample
 * against its checksum frozen at submit, then ElevenLabs Instant Voice Cloning
 * → provider readiness → READY + the pastor's active voice at that church.
 *
 * Never a blind duplicate create: a stored provider_voice_id is always reused,
 * and an uncertain create (timeout/5xx) goes to REGISTRATION_UNKNOWN and is
 * reconciled by exact-name lookup, never by creating again. Every db write
 * lives in a provider; this file only decides.
 */

const MAX_ATTEMPTS_RAW = Number(process.env.VOICE_REGISTER_MAX_ATTEMPTS ?? 5)
const MAX_ATTEMPTS =
  Number.isFinite(MAX_ATTEMPTS_RAW) && MAX_ATTEMPTS_RAW >= 1 ? MAX_ATTEMPTS_RAW : 5

// 30s, 60s, 120s… per attempt number.
const backoff = (attempts: number) => new Date(Date.now() + 30_000 * 2 ** attempts)

const ENV_TAG = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'local'

/**
 * Deterministic provider name: the reconcile key for an uncertain create. The
 * profile version changes on re-clone (Phase 6), giving that clone its own name.
 */
export const voiceName = (profileId: string, version: number) =>
  `prayer-${ENV_TAG}-${profileId}-v${version}`

type JobOutcome = 'succeeded' | 'failed' | 'requeued' | 'skipped'
type Job = { id: string; attempts: number }

const requeue = async (job: Job, errorCode: string): Promise<JobOutcome> => {
  await MARK_JOB_STATE({
    jobId: job.id,
    state: 'PENDING',
    errorCode,
    availableAt: backoff(job.attempts),
  })
  return 'requeued'
}

const succeed = async (job: Job, outcome: JobOutcome = 'succeeded'): Promise<JobOutcome> => {
  await MARK_JOB_STATE({ jobId: job.id, state: 'SUCCEEDED' })
  return outcome
}

/** Readiness check after a provider voice id is known; finalizes READY or holds. */
const settleReadiness = async (
  job: Job,
  profile: VoiceProfileForJob,
  providerVoiceId: string,
  fail: (code: string) => Promise<JobOutcome>,
  requestId: string,
): Promise<JobOutcome> => {
  const readiness = await ELEVENLABS.getVoiceReadiness(providerVoiceId)
  if (!readiness.found) {
    // Just created/stored but not visible yet: bounded wait, never a re-create.
    if (job.attempts >= MAX_ATTEMPTS) return fail('VOICE_NOT_FOUND_AFTER_CREATE')
    return requeue(job, 'VOICE_NOT_VISIBLE_YET')
  }
  if (readiness.requiresVerification) {
    await SET_REGISTRATION_STATE({ profileId: profile.id, state: 'VERIFICATION_REQUIRED' })
    return succeed(job) // held (D5): no polling loop, generation stays blocked
  }
  await FINALIZE_REGISTRATION_READY({
    profileId: profile.id,
    churchId: profile.church_id,
    pastorId: profile.pastor_id,
    requestId,
  })
  return succeed(job)
}

export const processVoiceRegisterJob = async (
  jobId: string,
  requestId: string,
): Promise<JobOutcome> => {
  const job = await GET_JOB({ jobId })
  if (!job || job.state !== 'RUNNING' || !job.resource_id) return 'skipped'
  const profile = await GET_PROFILE_FOR_JOB({ profileId: job.resource_id })
  if (!profile) return succeed(job) // deleted while queued

  // Terminal or held: duplicate delivery / disable won the race. Nothing to do.
  if (['DISABLED', 'READY', 'VERIFICATION_REQUIRED', 'FAILED'].includes(profile.registration_state))
    return succeed(job, 'skipped')

  const fail = async (errorCode: string): Promise<JobOutcome> => {
    await FINALIZE_REGISTRATION_FAILED({
      profileId: profile.id,
      churchId: profile.church_id,
      errorCode,
      requestId,
    })
    await MARK_JOB_STATE({ jobId: job.id, state: 'FAILED', errorCode })
    return 'failed'
  }

  // Guard ladder: approval enforced these; the worker re-proves each one.
  if (profile.review_state !== 'APPROVED') return fail('NOT_APPROVED')
  if (profile.consent.revoked_at) return fail('VOICE_CONSENT_REVOKED')
  if (profile.samples.length === 0) return fail('NO_SAMPLES')
  for (const s of profile.samples) {
    if (s.asset.status !== 'READY' || s.asset.church_id !== profile.church_id || !s.checksum)
      return fail('SAMPLE_INVALID')
  }

  const name = voiceName(profile.id, profile.version)

  try {
    // Repeated job after a successful create: reuse the stored voice.
    if (profile.provider_voice_id)
      return await settleReadiness(job, profile, profile.provider_voice_id, fail, requestId)

    // Uncertain earlier create: reconcile by lookup, never create again.
    if (profile.registration_state === 'REGISTRATION_UNKNOWN') {
      const found = await ELEVENLABS.findVoiceByName(name)
      if (!found) {
        if (job.attempts >= MAX_ATTEMPTS) return fail('REGISTRATION_UNRESOLVED')
        return requeue(job, 'REGISTRATION_RECONCILING')
      }
      await STORE_PROVIDER_VOICE({
        profileId: profile.id,
        providerVoiceId: found,
        requiresVerification: false,
      })
      return await settleReadiness(job, profile, found, fail, requestId)
    }

    // Download every approved sample and prove it is the submitted byte stream.
    const files = []
    for (const s of profile.samples) {
      const bytes = await S3_GET_OBJECT_BYTES({ key: s.asset.object_key })
      if (hashBytes(bytes) !== s.checksum) return fail('CHECKSUM_MISMATCH')
      files.push({
        bytes,
        mimeType: s.asset.mime_type,
        filename: `sample-${s.position + 1}`,
      })
    }

    const started = await SET_REGISTERING({
      profileId: profile.id,
      attemptId: crypto.randomUUID(),
    })
    if (started.count === 0) return succeed(job, 'skipped') // disabled meanwhile

    const created = await ELEVENLABS.registerInstantVoice({
      name,
      description: `PRAYER pastor voice ${profile.id}`,
      files,
    })
    // Persist first: a crash after this point reuses the id instead of re-creating.
    await STORE_PROVIDER_VOICE({
      profileId: profile.id,
      providerVoiceId: created.providerVoiceId,
      requiresVerification: created.requiresVerification,
    })

    // Disable / consent revocation while the provider call was in flight wins.
    const after = await GET_PROFILE_FOR_JOB({ profileId: profile.id })
    if (!after || after.registration_state === 'DISABLED' || after.consent.revoked_at) {
      await AUDIT_REGISTRATION_DISCARDED({
        profileId: profile.id,
        churchId: profile.church_id,
        requestId,
      })
      return succeed(job)
    }

    if (created.requiresVerification) {
      await SET_REGISTRATION_STATE({ profileId: profile.id, state: 'VERIFICATION_REQUIRED' })
      return succeed(job)
    }
    return await settleReadiness(job, after, created.providerVoiceId, fail, requestId)
  } catch (err) {
    // ElevenLabs' own message is the only clue to why it refused (plan, audio…):
    // keep it in the worker log. It never contains the API key.
    logger.warn('voice_register_error', {
      voice_profile_id: profile.id,
      error_code: err instanceof VoiceProviderError ? err.errorCode : 'INTERNAL_JOB_ERROR',
      provider_status: err instanceof VoiceProviderError ? err.providerStatus : undefined,
      error_message: err instanceof Error ? err.message : String(err),
    })
    if (err instanceof VoiceProviderError && err.kind === 'permanent') return fail(err.errorCode)
    if (err instanceof VoiceProviderError && err.kind === 'ambiguous') {
      await SET_REGISTRATION_STATE({
        profileId: profile.id,
        state: 'REGISTRATION_UNKNOWN',
        errorCode: err.errorCode,
      })
      return requeue(job, err.errorCode)
    }
    // Retryable provider error or infra hiccup (S3, db): bounded retries.
    const errorCode = err instanceof VoiceProviderError ? err.errorCode : 'INTERNAL_JOB_ERROR'
    if (job.attempts >= MAX_ATTEMPTS) return fail(errorCode)
    if (profile.registration_state !== 'REGISTRATION_UNKNOWN')
      await SET_REGISTRATION_STATE({ profileId: profile.id, state: 'QUEUED', errorCode })
    return requeue(job, errorCode)
  }
}

/**
 * One polling tick over the voice.register queue. While ElevenLabs is switched
 * off nothing is claimed, so approved voices wait instead of failing for good.
 */
export const runVoiceRegisterTick = async ({ limit = 3 }: { limit?: number } = {}) => {
  const summary = {
    enabled: isElevenLabsEnabled(),
    claimed: 0,
    succeeded: 0,
    failed: 0,
    requeued: 0,
    skipped: 0,
  }
  if (!summary.enabled) return summary
  const claimed = await CLAIM_PENDING_JOBS({ kind: 'voice.register', limit })
  summary.claimed = claimed.length
  for (const job of claimed) {
    try {
      summary[await processVoiceRegisterJob(job.id, crypto.randomUUID())]++
    } catch {
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
