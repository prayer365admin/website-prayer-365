import { db } from '../../src/utils/db-connection'
import { getDemoChurch } from './test-context'

// Placeholder event.
export const seedEvents = async () => {
  const existing = await db.event.findFirst({})
  if (existing) return
  const church = await getDemoChurch()
  if (!church) throw new Error('seedEvents: demo church missing')
  await db.event.create({
    data: {
      church_id: church.id,
      category: 'SERVICE',
      title: 'Demo Sunday Service',
      description: 'Demo event.',
      starts_at: new Date('2026-10-04T10:00:00Z'),
      location: 'Main Hall',
      language_code: 'et',
    },
  })
}
