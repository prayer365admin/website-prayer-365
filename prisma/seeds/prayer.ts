import { db } from '../../src/utils/db-connection'
import { DEMO_CHURCH_NAME, DEMO_PASTOR_NAME, getAdminUser } from './test-context'

// Placeholder prayer + version + approved audio.
export const seedPrayers = async () => {
  const existing = await db.prayer.findFirst({})
  if (existing) return

  const church = await db.church.findFirst({ where: { name: DEMO_CHURCH_NAME } })
  const pastor = await db.pastor.findFirst({ where: { name: DEMO_PASTOR_NAME } })
  const actor = await getAdminUser()
  const voice = await db.voiceProfile.findFirst({ where: { registration_state: 'READY' } })
  const audioAsset = await db.mediaAsset.findFirst({ where: { purpose: 'GENERATED_AUDIO' } })
  if (!church || !pastor || !actor || !voice || !audioAsset)
    throw new Error('seedPrayers: deps missing')

  const prayer = await db.prayer.create({
    data: { church_id: church.id, created_by: actor.id, published_at: new Date() },
  })
  const version = await db.prayerVersion.create({
    data: {
      prayer_id: prayer.id,
      version_number: 1,
      pastor_id: pastor.id,
      title: 'Demo Morning Prayer',
      body: 'Demo prayer body.',
      language_code: 'et',
      text_hash: 'demo-prayer-hash-1',
      approved_by: actor.id,
      approved_at: new Date(),
    },
  })

  const audio = await db.prayerAudio.create({
    data: {
      prayer_version_id: version.id,
      voice_profile_id: voice.id,
      status: 'APPROVED',
      asset_id: audioAsset.id,
      provider_request_id: 'demo_gen_req_1',
      approved_by: actor.id,
      approved_at: new Date(),
    },
  })

  await db.prayerVersion.update({
    where: { id: version.id },
    data: { selected_audio_id: audio.id },
  })
  await db.prayer.update({
    where: { id: prayer.id },
    data: { current_version_id: version.id, published_version_id: version.id },
  })
}
