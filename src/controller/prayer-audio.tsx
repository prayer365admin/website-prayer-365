import { GeneralError } from '@/utils/general-error'
import { withIdempotency } from '@/utils/idempotency'
import { auditPayload } from '@/utils/audit'
import {
  APPROVE_AUDIO,
  CREATE_AUDIO,
  CREATE_AUDIO_OUTBOX,
  GET_AUDIO,
  GET_READY_VOICE,
  GET_VERSION,
} from '@/providers/prayer-audio'
import { PrayerActionInput, PrayerAudioEnqueueInput, PrayerAudioOutput } from '@/models/prayer'

/*
 * Prayer audio business logic (Tasks 23/24).
 *
 * Enqueue (Task 23) validates — atomically inside the idempotency transaction —
 * that the current text snapshot is approved, and that the chosen voice is
 * provider-ready (review APPROVED, registration READY, consent not revoked,
 * belongs to this church and the version's pastor). Inserts PrayerAudio
 * (QUEUED) + `audio.generate` outbox → 202. withIdempotency makes repeated
 * deliveries safe.
 *
 * Approve (Task 24) is a prayer_prayer_review action: same snapshot + a READY
 * audio → marks it approved and selects it on the version.
 */

const scopeError = () =>
  new GeneralError({
    code: 403,
    error: 'UNAUTHORIZED',
    error_code: 'NOT_ALLOWED',
    details: 'This account is not allowed for this church.',
  })
const notFound = () =>
  new GeneralError({
    code: 404,
    error: 'NOT_FOUND',
    error_code: 'RESOURCE_NOT_FOUND',
    details: 'Prayer audio not found.',
  })
const stale = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'STALE_VERSION',
    details: 'This prayer has changed. Refresh and try again.',
  })
const notCurrent = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'WRONG_SNAPSHOT',
    details: 'That version is not the current snapshot.',
  })

const mapAudio = (r: NonNullable<Awaited<ReturnType<typeof GET_AUDIO>>>): PrayerAudioOutput => ({
  id: r.id,
  prayerVersionId: r.prayer_version_id,
  prayerId: r.prayer_id,
  voiceProfileId: r.voice_profile_id,
  status: r.status,
  assetId: r.asset_id,
  providerRequestId: r.provider_request_id,
  approvedBy: r.approved_by,
  approvedAt: r.approved_at ? r.approved_at.toISOString() : null,
  errorCode: r.error_code,
  createdAt: r.created_at.toISOString(),
})

/** POST audio: validate approved text + ready voice, queue audio + outbox → 202. */
export const enqueueAudio = async ({
  userId,
  churchId,
  churchIds,
  prayerId,
  input,
  idempotencyKey,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  prayerId: string
  input: PrayerAudioEnqueueInput
  idempotencyKey?: string
  requestId: string
}): Promise<PrayerAudioOutput> => {
  if (!churchIds.has(churchId)) throw scopeError()
  const ctx = await GET_VERSION({ churchIds, prayerId, versionId: input.prayerVersionId })
  if (!ctx) throw notFound()
  if (ctx.prayer.version !== input.version) throw stale()
  if (ctx.prayer.current_version_id !== input.prayerVersionId) throw notCurrent()

  const { resource_id } = await withIdempotency({
    actorKey: `user:${userId}`,
    operation: 'audio.generate',
    key: idempotencyKey ?? '',
    requestBody: input,
    run: async (tx) => {
      // Re-read inside the transaction so the generator + outbox commit atomically.
      const verse = await tx.prayerVersion.findFirst({
        where: { id: input.prayerVersionId, prayer_id: prayerId },
        select: { approved_at: true, pastor_id: true, text_hash: true },
      })
      if (!verse) throw notFound()
      if (!verse.approved_at) {
        throw new GeneralError({
          code: 409,
          error: 'CONFLICT',
          error_code: 'GENERATION_BEFORE_APPROVAL',
          details: 'Approve the current text before generating audio.',
        })
      }
      const voice = await GET_READY_VOICE(tx, {
        churchId,
        voiceProfileId: input.voiceProfileId,
        requiredPastorId: verse.pastor_id,
      })
      if (!voice) {
        throw new GeneralError({
          code: 409,
          error: 'CONFLICT',
          error_code: 'VOICE_NOT_READY',
          details:
            'The voice profile is not approved, not ready, or not assigned to this church/pastor.',
        })
      }
      if (voice.consent?.revoked_at) {
        throw new GeneralError({
          code: 409,
          error: 'CONFLICT',
          error_code: 'VOICE_CONSENT_REVOKED',
          details: 'The voice consent has been revoked.',
        })
      }
      const audio = await CREATE_AUDIO(tx, {
        prayer_version_id: input.prayerVersionId,
        voice_profile_id: input.voiceProfileId,
        status: 'QUEUED',
      })
      await CREATE_AUDIO_OUTBOX(tx, {
        kind: 'audio.generate',
        dedupe_key: `audio.generate:${input.prayerVersionId}:${input.voiceProfileId}`,
        resource_id: audio.id,
        payload: {
          prayerVersionId: input.prayerVersionId,
          voiceProfileId: input.voiceProfileId,
          churchId,
          textHash: verse.text_hash,
        },
        available_at: new Date(),
      })
      await tx.auditLog.create({
        data: auditPayload({
          actorId: userId,
          churchId,
          action: 'prayer.audio.enqueue',
          resourceType: 'prayer_audio',
          resourceId: audio.id,
          outcome: 'success',
          requestId,
        }),
      })
      return audio.id
    },
  })

  const resourceId = resource_id
  if (!resourceId) throw notFound()
  const row = await GET_AUDIO({ churchIds, prayerId, audioId: resourceId })
  if (!row) throw notFound()
  return mapAudio(row)
}

/** GET audio: generation state + preview info, scoped to this church/prayer. */
export const getAudio = async ({
  churchIds,
  prayerId,
  audioId,
}: {
  churchIds: Set<string>
  prayerId: string
  audioId: string
}): Promise<PrayerAudioOutput> => {
  const row = await GET_AUDIO({ churchIds, prayerId, audioId })
  if (!row) throw notFound()
  return mapAudio(row)
}

/** approve audio: reviewer, same snapshot + READY audio → approved + selected. */
export const approveAudio = async ({
  userId,
  churchId,
  churchIds,
  prayerId,
  audioId,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  prayerId: string
  audioId: string
  input: PrayerActionInput
  requestId: string
}): Promise<PrayerAudioOutput> => {
  if (!churchIds.has(churchId)) throw scopeError()
  const ctx = await GET_VERSION({ churchIds, prayerId, versionId: input.prayerVersionId })
  if (!ctx) throw notFound()
  if (ctx.prayer.version !== input.version) throw stale()
  if (ctx.prayer.current_version_id !== input.prayerVersionId) throw notCurrent()
  return APPROVE_AUDIO({
    churchIds,
    prayerId,
    audioId,
    expectedVersion: input.version,
    prayerVersionId: input.prayerVersionId,
    actorId: userId,
    requestId,
  })
}
