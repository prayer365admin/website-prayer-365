import { db } from '../../src/utils/db-connection'
import { getDemoChurch } from './test-context'

// Placeholder announcement.
export const seedAnnouncements = async () => {
  const church = await getDemoChurch()
  if (!church) throw new Error('seedAnnouncements: demo church missing')

  const announcements = [
    {
      title: 'Organ Restoration Project Phase II',
      body: 'Specialist restoration of the historic 1867 Walcker pipe organ continues through autumn. Midday prayer meditations and Sunday liturgies proceed as scheduled.',
    },
    {
      title: 'Sunday School & Junior Choir Gathering',
      body: 'Weekly youth and family gathering during the 10:00 service in the parish hall. All children and families are warmly welcome.',
    },
  ]

  for (const a of announcements) {
    const existing = await db.announcement.findFirst({
      where: { church_id: church.id, title: a.title },
    })
    if (!existing) {
      await db.announcement.create({
        data: {
          church_id: church.id,
          title: a.title,
          body: a.body,
          published_at: new Date(),
        },
      })
    }
  }
}
