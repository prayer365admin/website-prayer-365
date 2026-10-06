import { db } from '@/utils/db-connection'
import { MediaPurpose, MediaStatus } from '@/models/media'

/*
 * Media data adapter (Task 33/34). Thin Prisma access for media assets.
 * Scoping is the controller's job; every read that must be tenant-safe accepts
 * a `churchIds` set and uses it in the where clause.
 */

const toIds = (s: Set<string>) => Array.from(s)

export const CREATE_PENDING_ASSET = ({
  churchId,
  purpose,
  mimeType,
  byteSize,
  objectKey,
  uploadedBy,
}: {
  churchId: string
  purpose: MediaPurpose
  mimeType: string
  byteSize: number
  objectKey: string
  uploadedBy: string | null
}) =>
  db.mediaAsset.create({
    data: {
      church_id: churchId,
      purpose,
      mime_type: mimeType,
      byte_size: BigInt(byteSize),
      object_key: objectKey,
      status: 'PENDING',
      uploaded_by: uploadedBy,
    },
  })

/** By assetId + the URL church id. Used when the caller's scope is still being resolved. */
export const GET_ASSET_BY_ID_AND_CHURCH = ({
  assetId,
  churchId,
}: {
  assetId: string
  churchId: string
}) =>
  db.mediaAsset.findFirst({
    where: { id: assetId, church_id: churchId },
  })

/**
 * Preview visibility additionally permits a canonical Pastor image when the
 * Pastor is assigned to the requesting church. The underlying asset remains
 * owned by its original church; this only broadens read visibility for the
 * shared profile image.
 */
export const GET_ASSET_VISIBLE_TO_CHURCH = ({
  assetId,
  churchId,
}: {
  assetId: string
  churchId: string
}) =>
  db.mediaAsset.findFirst({
    where: {
      id: assetId,
      OR: [
        { church_id: churchId },
        {
          purpose: 'IMAGE',
          pastorProfiles: {
            some: { churchPastors: { some: { church_id: churchId } } },
          },
        },
      ],
    },
  })

/** Scoped read: only returns the asset when it belongs to one of `churchIds`. */
export const GET_ASSET = async ({
  churchIds,
  assetId,
}: {
  churchIds: Set<string>
  assetId: string
}) => {
  const ids = toIds(churchIds)
  if (ids.length === 0) return null
  return db.mediaAsset.findFirst({ where: { id: assetId, church_id: { in: ids } } })
}

/** Flip a PENDING asset to READY (no-op count=0 when not PENDING or out of scope). */
export const MARK_READY = async ({
  churchIds,
  assetId,
  checksum,
}: {
  churchIds: Set<string>
  assetId: string
  checksum: string
}) =>
  db.mediaAsset.updateMany({
    where: {
      id: assetId,
      church_id: { in: toIds(churchIds) },
      status: 'PENDING',
    },
    data: { status: 'READY' as MediaStatus, checksum, updated_at: new Date() },
  })

/**
 * Unattached PENDING assets older than `olderThan` — nothing references them
 * (no church cover, pastor image, voice sample, consent evidence or generated
 * audio). Used by the cleanup job (Task 34).
 */
export const LIST_UNATTACHED_PENDING_OLDER_THAN = ({ olderThan }: { olderThan: Date }) =>
  db.mediaAsset.findMany({
    where: {
      status: 'PENDING' as MediaStatus,
      created_at: { lt: olderThan },
      coverOf: { none: {} },
      pastorProfiles: { none: {} },
      pastorImages: { none: {} },
      voiceSamples: { none: {} },
      consentEvidence: { none: {} },
      audioAssets: { none: {} },
    },
    select: { id: true, object_key: true },
  })

export const DELETE_ASSET = ({ assetId }: { assetId: string }) =>
  db.mediaAsset.delete({ where: { id: assetId } })
