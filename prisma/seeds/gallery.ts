import { db } from '../../src/utils/db-connection'
import { DEMO_CHURCH_NAME, getDemoChurch, getAdminUser } from './test-context'

export const seedGalleryItems = async () => {
  const church = await getDemoChurch()
  const actor = await getAdminUser()
  if (!church || !actor) throw new Error('seedGalleryItems: demo church/admin missing')

  // Find or create cover asset
  const coverKey = '/images/church.jpeg'
  let coverAsset = await db.mediaAsset.findUnique({ where: { object_key: coverKey } })
  if (!coverAsset) {
    coverAsset = await db.mediaAsset.create({
      data: {
        church_id: church.id,
        object_key: coverKey,
        purpose: 'IMAGE',
        mime_type: 'image/jpeg',
        byte_size: 50388,
        status: 'READY',
        checksum: '41e8f23b32cba394ab67f8326d218667',
        uploaded_by: actor.id,
      },
    })
  }

  // Find or create second gallery image asset
  const gallery1Key = `demo/${DEMO_CHURCH_NAME}-gallery1`
  let gallery1Asset = await db.mediaAsset.findUnique({ where: { object_key: gallery1Key } })
  if (!gallery1Asset) {
    gallery1Asset = await db.mediaAsset.create({
      data: {
        church_id: church.id,
        object_key: gallery1Key,
        purpose: 'IMAGE',
        mime_type: 'image/jpeg',
        byte_size: 153600,
        status: 'READY',
        checksum: 'demo-checksum-gallery1',
        uploaded_by: actor.id,
      },
    })
  }

  const items = [
    {
      media_asset_id: coverAsset.id,
      caption: 'Nave from the west door',
      order_index: 0,
    },
    {
      media_asset_id: gallery1Asset.id,
      caption: 'Altar & stained glass',
      order_index: 1,
    },
  ]

  for (const item of items) {
    const existing = await db.churchGalleryItem.findFirst({
      where: {
        church_id: church.id,
        order_index: item.order_index,
      },
    })
    if (existing) {
      await db.churchGalleryItem.update({
        where: { id: existing.id },
        data: {
          media_asset_id: item.media_asset_id,
          caption: item.caption,
        },
      })
    } else {
      await db.churchGalleryItem.create({
        data: {
          church_id: church.id,
          media_asset_id: item.media_asset_id,
          caption: item.caption,
          order_index: item.order_index,
        },
      })
    }
  }
}
