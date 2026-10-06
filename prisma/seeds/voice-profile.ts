import { db } from '../../src/utils/db-connection'
import { DEMO_CHURCH_NAME, DEMO_PASTOR_NAME, getAdminUser } from './test-context'

// Placeholder voice profile (approved + ready) for the demo pastor/church.
export const seedVoiceProfiles = async () => {
  const existing = await db.voiceProfile.findFirst({ where: { registration_state: 'READY' } })
  if (existing) return

  const church = await db.church.findFirst({ where: { name: DEMO_CHURCH_NAME } })
  const pastor = await db.pastor.findFirst({ where: { name: DEMO_PASTOR_NAME } })
  const actor = await getAdminUser()
  const sample = await db.mediaAsset.findFirst({ where: { purpose: 'VOICE_SAMPLE' } })
  const consent = await db.consent.findFirst({ where: { purpose: 'voice_cloning' } })
  if (!church || !pastor || !actor || !sample || !consent)
    throw new Error('seedVoiceProfiles: deps missing')

  const voiceProfile = await db.voiceProfile.create({
    data: {
      pastor_id: pastor.id,
      church_id: church.id,
      submitted_by: actor.id,
      provider: 'elevenlabs',
      cloning_method: 'instant',
      provider_voice_id: 'demo_voice_id', // placeholder, server-managed in prod
      consent_id: consent.id,
      samples: { create: [{ asset_id: sample.id, position: 0, checksum: sample.checksum }] },
      submitted_at: new Date(),
      review_state: 'APPROVED',
      reviewed_by: actor.id,
      reviewed_at: new Date(),
      registration_state: 'READY',
      requires_verification: false,
    },
  })

  // Activate for this church pastor.
  const pastorLink = await db.churchPastor.findFirst({
    where: { church_id: church.id, pastor_id: pastor.id },
  })
  if (pastorLink) {
    await db.churchPastor.update({
      where: { church_id_pastor_id: { church_id: church.id, pastor_id: pastor.id } },
      data: { active_voice_profile_id: voiceProfile.id },
    })
  }
}
