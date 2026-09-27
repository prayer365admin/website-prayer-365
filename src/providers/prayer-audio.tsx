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
 * outbox dedupe_key makes replay safe; withIdempotency makes the caller's key
 * safe.
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
