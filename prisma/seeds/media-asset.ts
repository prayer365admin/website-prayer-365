import { DEMO_CONSENT_KEY, DEMO_VOICE_SAMPLE_KEY } from './demo-media'
import { ensureMediaAsset } from './demo-content'
import { getAdminUser, getDemoChurch } from './test-context'

/*
 * The two media assets the voice-cloning flow needs before a voice profile can
 * exist: the pastor's recorded sample and the signed consent document. Both
 * reference objects that ensureDemoMedia() uploads into the ACTIVE bucket, so the
 * admin voice-review screen opens a real file in every environment.
 *
 * Church covers, gallery images and prayer audio are created by
 * seedChurchContent / seedChurchPrayers.
 */
export const seedMediaAssets = async () => {
  const church = await getDemoChurch()
  const actor = await getAdminUser()
  if (!church || !actor) throw new Error('seedMediaAssets: demo church/admin missing')

  const sample = await ensureMediaAsset({
    churchId: church.id,
    key: DEMO_VOICE_SAMPLE_KEY,
    purpose: 'VOICE_SAMPLE',
    actorId: actor.id,
  })
  const evidence = await ensureMediaAsset({
    churchId: church.id,
    key: DEMO_CONSENT_KEY,
    purpose: 'CONSENT_EVIDENCE',
    actorId: actor.id,
  })

  return { sample: sample.id, evidence: evidence.id }
}
