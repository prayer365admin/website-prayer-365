import { db } from '../../src/utils/db-connection'
import { getDemoChurch } from './test-context'

// Placeholder announcement.
export const seedAnnouncements = async () => {
  const existing = await db.announcement.findFirst({})
  if (existing) return
  const church = await getDemoChurch()
  if (!church) throw new Error('seedAnnouncements: demo church missing')
  await db.announcement.create({
    data: {
      church_id: church.id,
      title: 'Demo Announcement',
      body: 'Demo announcement body.',
      published_at: new Date(),
    },
  })
}
