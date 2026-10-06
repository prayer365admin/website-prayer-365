import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import { auditPayload } from '@/utils/audit'
import { GET_VERSION } from '@/providers/prayer'

/*
 * Prayer audio adapter (Tasks 23/24).
 *
 * Enqueue validates, inside the idempotency transaction, that the current text
 * snapshot is approved and that the voice is provider-ready (review APPROVED,
 * registration READY, consent not revoked, belongs to this church + pastor),
 * then inserts PrayerAudio (QUEUED) + an `audio.generate` outbox row. The
 * outbox dedupe_key (per audio row) makes job delivery idempotent;
 * withIdempotency makes the caller's key safe.
 */

export { GET_VERSION }

const notFound = () =>
  new GeneralError({
    code: 404,
    error: 'NOT_FOUND',
    error_code: 'RESOURCE_NOT_FOUND',
    details: 'Audio not found.',
  })

export const GET_READY_VOICE = async (
  tx: Prisma.TransactionClient,
  {
    churchId,
    voiceProfileId,
    requiredPastorId,
  }: { churchId: string; voiceProfileId: string; requiredPastorId: string },
): Promise<{ consent: { revoked_at: Date | null } | null } | null> =>
  tx.voiceProfile.findFirst({
    where: {
      id: voiceProfileId,
      church_id: churchId,
      review_state: 'APPROVED',
      registration_state: 'READY',
      pastor_id: requiredPastorId,
    },
    include: { consent: { select: { revoked_at: true } } },
  })

export const CREATE_AUDIO = (
  tx: Prisma.TransactionClient,
  data: Prisma.PrayerAudioUncheckedCreateInput,
) => tx.prayerAudio.create({ data })

export const CREATE_AUDIO_OUTBOX = (
  tx: Prisma.TransactionClient,
  data: Prisma.OutboxJobUncheckedCreateInput,
) => tx.outboxJob.create({ data })

export const GET_AUDIO = async ({
  churchIds,
  prayerId,
  audioId,
}: {
  churchIds: Set<string>
  prayerId: string
  audioId: string
}): Promise<{
  id: string
  prayer_version_id: string
  voice_profile_id: string
  status: string
  asset_id: string | null
  provider_request_id: string | null
  approved_by: string | null
  approved_at: Date | null
  error_code: string | null
  created_at: Date
  prayer_id: string
} | null> => {
  const ids = Array.from(churchIds)
  if (ids.length === 0) return null
  return db.prayerAudio
    .findFirst({
      where: { id: audioId, verse: { prayer: { id: prayerId, church_id: { in: ids } } } },
      select: {
        id: true,
        prayer_version_id: true,
        voice_profile_id: true,
        status: true,
        asset_id: true,
        provider_request_id: true,
        approved_by: true,
        approved_at: true,
        error_code: true,
        created_at: true,
      },
    })
    .then((r) => (r ? { ...r, prayer_id: prayerId } : null))
}

const mapAudio = (r: {
  id: string
  prayer_version_id: string
  prayer_id: string
  voice_profile_id: string
  status: string
  asset_id: string | null
  provider_request_id: string | null
  approved_by: string | null
  approved_at: Date | null
  error_code: string | null
  created_at: Date
}) => ({
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

/** approve: same snapshot + ready audio → mark approved and select on version. */
export const APPROVE_AUDIO = async ({
  churchIds,
  prayerId,
  audioId,
  expectedVersion,
  prayerVersionId,
  actorId,
  requestId,
}: {
  churchIds: Set<string>
  prayerId: string
  audioId: string
  expectedVersion: number
  prayerVersionId: string
  actorId: string
  requestId: string
}) => {
  const churchId = Array.from(churchIds)[0]
  if (!churchId) throw notFound()
  return db.$transaction(async (tx) => {
    const bumped = await tx.prayer.updateMany({
      where: { id: prayerId, church_id: churchId, version: expectedVersion },
      data: { version: { increment: 1 }, updated_at: new Date() },
    })
    if (bumped.count === 0) {
      throw new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'STALE_VERSION',
        details: 'This prayer has changed. Refresh and try again.',
      })
    }
    const audio = await tx.prayerAudio.findFirst({
      where: {
        id: audioId,
        prayer_version_id: prayerVersionId,
        verse: { prayer: { id: prayerId } },
      },
      select: { id: true, status: true },
    })
    if (!audio) throw notFound()
    if (audio.status !== 'READY') {
      throw new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'AUDIO_NOT_READY',
        details: 'Audio must be generated before approval.',
      })
    }
    const now = new Date()
    await tx.prayerAudio.update({
      where: { id: audioId },
      data: { status: 'APPROVED', approved_by: actorId, approved_at: now },
    })
    await tx.prayerVersion.update({
      where: { id: prayerVersionId },
      data: { selected_audio_id: audioId },
    })
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        churchId,
        action: 'prayer.audio.approve',
        resourceType: 'prayer_audio',
        resourceId: audioId,
        outcome: 'success',
        requestId,
      }),
    })
    const row = await tx.prayerAudio.findUnique({
      where: { id: audioId },
      select: {
        id: true,
        prayer_version_id: true,
        voice_profile_id: true,
        status: true,
        asset_id: true,
        provider_request_id: true,
        approved_by: true,
        approved_at: true,
        error_code: true,
        created_at: true,
      },
    })
    return mapAudio({ ...(row as NonNullable<typeof row>), prayer_id: prayerId })
  })
}

// ============================================================================
// audio.generate worker side (PR-07). The worker is trusted infrastructure —
// reads are unscoped; every business guard lives in the job controller.
// ============================================================================

const AUDIO_IN_FLIGHT: ('QUEUED' | 'GENERATING')[] = ['QUEUED', 'GENERATING']

/** Unscoped join used only by the worker: audio + its text version + ready-voice facts. */
export const GET_AUDIO_FOR_JOB = ({ audioId }: { audioId: string }) =>
  db.prayerAudio.findUnique({
    where: { id: audioId },
    select: {
      id: true,
      status: true,
      provider_request_id: true,
      verse: {
        select: {
          id: true,
          approved_at: true,
          text_hash: true,
          body: true,
          language_code: true,
          version_number: true,
          pastor_id: true,
          prayer: {
            select: { id: true, church_id: true, version: true, current_version_id: true },
          },
        },
      },
      voice_profile: {
        select: {
          id: true,
          church_id: true,
          provider_voice_id: true,
          review_state: true,
          registration_state: true,
          consent: { select: { revoked_at: true } },
        },
      },
    },
  })

/** QUEUED|GENERATING → GENERATING (no-op count=0 once another worker finalized). */
export const SET_AUDIO_GENERATING = ({ audioId }: { audioId: string }) =>
  db.prayerAudio.updateMany({
    where: { id: audioId, status: { in: AUDIO_IN_FLIGHT } },
    data: { status: 'GENERATING' },
  })

/** Transient failure → back to QUEUED so polling UI still shows "generating"; error code cleared. */
export const RESET_AUDIO_QUEUED = ({ audioId }: { audioId: string }) =>
  db.prayerAudio.updateMany({
    where: { id: audioId, status: { in: AUDIO_IN_FLIGHT } },
    data: { status: 'QUEUED', error_code: null },
  })

/** Store READY + asset in one transaction with the audit row. Caller checks `.count`. */
export const FINALIZE_AUDIO_READY = async ({
  audioId,
  churchId,
  assetId,
  providerRequestId,
  requestId,
}: {
  audioId: string
  churchId: string
  assetId: string
  providerRequestId: string | null
  requestId: string
}) =>
  db.$transaction(async (tx) => {
    const done = await tx.prayerAudio.updateMany({
      where: { id: audioId, status: { in: AUDIO_IN_FLIGHT } },
      data: { status: 'READY', asset_id: assetId, provider_request_id: providerRequestId },
    })
    await tx.auditLog.create({
      data: auditPayload({
        actorId: null,
        churchId,
        action: 'prayer.audio.generate',
        resourceType: 'prayer_audio',
        resourceId: audioId,
        outcome: 'success',
        requestId,
      }),
    })
    return done
  })

/** Permanent failure + audit. Caller checks `.count`. */
export const FINALIZE_AUDIO_FAILED = async ({
  audioId,
  churchId,
  errorCode,
  requestId,
}: {
  audioId: string
  churchId: string
  errorCode: string
  requestId: string
}) =>
  db.$transaction(async (tx) => {
    const done = await tx.prayerAudio.updateMany({
      where: { id: audioId, status: { in: AUDIO_IN_FLIGHT } },
      data: { status: 'FAILED', error_code: errorCode },
    })
    await tx.auditLog.create({
      data: auditPayload({
        actorId: null,
        churchId,
        action: 'prayer.audio.generate',
        resourceType: 'prayer_audio',
        resourceId: audioId,
        outcome: 'failure',
        requestId,
      }),
    })
    return done
  })
