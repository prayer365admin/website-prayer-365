import { db } from '../../src/utils/db-connection'
import { DEMO_PASTOR_NAME, getAdminUser } from './test-context'

// Placeholder voice-cloning consent (evidence asset may be attached by caller).
export const seedConsents = async () => {
  const existing = await db.consent.findFirst({ where: { purpose: 'voice_cloning' } })
  if (existing) return

  const pastor = await db.pastor.findFirst({ where: { name: DEMO_PASTOR_NAME } })
  const actor = await getAdminUser()
  if (!pastor || !actor) throw new Error('seedConsents: pastor/admin missing')

  return db.consent.create({
    data: {
      pastor_id: pastor.id,
      purpose: 'voice_cloning',
      terms_version: 'demo-1',
      recorded_by: actor.id,
    },
  })
}
