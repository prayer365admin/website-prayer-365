import { DELETE_ASSET, LIST_UNATTACHED_PENDING_OLDER_THAN } from '@/providers/media'
import { S3_DELETE_OBJECT } from '@/providers/s3'

/*
 * Media upload cleanup (Task 34).
 *
 * Deletes unattached PENDING media assets (and their S3 objects) that are older
 * than the TTL. "Unattached" = nothing references the asset as a church cover,
 * pastor image, voice sample, consent evidence or generated audio — these are
 * abandoned uploads that were never completed and never attached. This is a
 * plain function (no scheduler wired here): callers decide when to run it.
 *
 * It is NOT transactional per asset: the S3 object is deleted first, then the
 * DB row, so a failed cleanup never leaves a row pointing at a live object that
 * would leak via a signed URL.
 */
export const runMediaCleanup = async ({
  ttlDays,
  now = new Date(),
}: {
  ttlDays: number
  now?: Date
}): Promise<number> => {
  const cutoff = new Date(now.getTime() - ttlDays * 24 * 60 * 60 * 1000)
  const assets = await LIST_UNATTACHED_PENDING_OLDER_THAN({ olderThan: cutoff })
  for (const a of assets) {
    await S3_DELETE_OBJECT({ key: a.object_key })
    await DELETE_ASSET({ assetId: a.id })
  }
  return assets.length
}
