import { db } from '../../src/utils/db-connection'
import { getDemoChurch } from './test-context'

const DAY = 24 * 60 * 60 * 1000

// Demo events for the Tallinn demo church: spread around "now" so the list shows
// past, imminent (today / tomorrow / within 3 and 7 days) and far-future events,
// all categories, with and without registration links. Idempotent by title.
const DEMO_EVENTS = [
  { offset: -21, category: 'SERVICE', title: 'Past Sunday Service', location: 'Main Hall' },
  { offset: -7, category: 'BIBLE_STUDY', title: 'Past Bible Study', location: 'Room 2' },
  { offset: 0, category: 'SERVICE', title: 'Sunday Service', location: 'Main Hall' },
  {
    offset: 1,
    category: 'COMMUNITY',
    title: 'Community Lunch',
    location: 'Parish Kitchen',
    link: 'https://example.org/lunch',
  },
  { offset: 2, category: 'BIBLE_STUDY', title: 'Midweek Bible Study', location: 'Room 2' },
  { offset: 3, category: 'SPECIAL', title: 'Choir Rehearsal', location: 'Main Hall' },
  {
    offset: 5,
    category: 'SPECIAL',
    title: 'Baptism Celebration',
    location: 'Main Hall',
    link: 'https://example.org/baptism',
  },
  { offset: 7, category: 'COMMUNITY', title: 'Youth Night', location: 'Annex' },
  { offset: 10, category: 'SERVICE', title: 'Evening Prayer', location: 'Chapel' },
  {
    offset: 14,
    category: 'COMMUNITY',
    title: 'Charity Bake Sale',
    location: 'Church Yard',
    link: 'https://example.org/bake-sale',
  },
  {
    offset: 21,
    category: 'SPECIAL',
    title: 'Harvest Festival',
    location: 'Main Hall',
    link: 'https://example.org/harvest',
  },
  { offset: 28, category: 'BIBLE_STUDY', title: 'Gospel of John Study', location: 'Room 1' },
  { offset: 35, category: 'OTHER', title: 'Volunteer Meeting', location: 'Office' },
  {
    offset: 45,
    category: 'SPECIAL',
    title: 'Advent Concert',
    location: 'Main Hall',
    link: 'https://example.org/concert',
  },
  { offset: 60, category: 'SERVICE', title: 'Christmas Eve Service', location: 'Main Hall' },
] as const

export const seedEvents = async () => {
  const church = await getDemoChurch()
  if (!church) throw new Error('seedEvents: demo church missing')

  for (let index = 0; index < DEMO_EVENTS.length; index++) {
    const e = DEMO_EVENTS[index]
    const existing = await db.event.findFirst({
      where: { church_id: church.id, title: e.title },
    })
    if (existing) continue
    const startsAt = new Date(Date.now() + e.offset * DAY)
    startsAt.setUTCHours(7 + (index % 6), index % 2 ? 30 : 0, 0, 0)
    await db.event.create({
      data: {
        church_id: church.id,
        category: e.category,
        title: e.title,
        description: `Demo event: ${e.title}.`,
        starts_at: startsAt,
        location: e.location,
        registration_url: 'link' in e ? e.link : null,
        language_code: index % 3 === 0 ? 'et' : 'en',
      },
    })
  }
}
