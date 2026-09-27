import { db } from '../../src/utils/db-connection'
import type { MediaPurpose } from '@prisma/client'
import { DEMO_CHURCH_NAME, getDemoChurch, getAdminUser } from './test-context'

// Placeholder media assets (cover, voice sample, consent evidence, audio).
interface AssetDef {
  purpose: MediaPurpose
  mime_type: string
  byte_size: number
}

export const seedMediaAssets = async () => {
  const church = await getDemoChurch()
  const actor = await getAdminUser()
  if (!church || !actor) throw new Error('seedMediaAssets: demo church/admin missing')

  const defs: Record<string, AssetDef> = {
    cover: { purpose: 'IMAGE', mime_type: 'image/jpeg', byte_size: 102400 },
    sample: { purpose: 'VOICE_SAMPLE', mime_type: 'audio/wav', byte_size: 2051200 },
    evidence: { purpose: 'CONSENT_EVIDENCE', mime_type: 'application/pdf', byte_size: 51200 },
    audio: { purpose: 'GENERATED_AUDIO', mime_type: 'audio/mpeg', byte_size: 307200 },
  }

  const created: Record<string, string> = {}
  for (const [key, def] of Object.entries(defs)) {
    const object_key = `demo/${DEMO_CHURCH_NAME}-${key}`
    let asset = await db.mediaAsset.findUnique({ where: { object_key } })
    if (!asset) {
      asset = await db.mediaAsset.create({
        data: {
          church_id: church.id,
          object_key,
          status: 'READY',
          checksum: `demo-checksum-${key}`,
          uploaded_by: actor.id,
          ...def,
        },
      })
    }
    created[key] = asset.id
  }
  return created
}
