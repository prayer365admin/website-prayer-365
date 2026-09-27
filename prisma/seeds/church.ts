import { db } from '../../src/utils/db-connection'
import { DEMO_CHURCH_NAME, DEMO_CHURCH_NODE_NAME, getAdminUser } from './test-context'

// Placeholder church + its languages + service times.
export const seedChurches = async () => {
  const existing = await db.church.findFirst({ where: { name: DEMO_CHURCH_NAME } })
  if (existing) return

  const node = await db.orgNode.findFirst({ where: { name: DEMO_CHURCH_NODE_NAME } })
  const admin = await getAdminUser()
  if (!node || !admin) throw new Error('seedChurches: org node / admin missing')

  const church = await db.church.create({
    data: {
      org_node_id: node.id,
      name: DEMO_CHURCH_NAME,
      status: 'APPROVED',
      timezone: 'Europe/Tallinn',
      description: 'Demo church for testing.',
      address: { line1: 'Test Str 1', city: 'Tallinn', countryCode: 'EE' },
      contacts: { email: 'demo@example.com', phone: '+3720000000' },
      social_links: [],
      approved_by: admin.id,
      approved_at: new Date(),
    },
  })

  for (const language_code of ['et', 'en']) {
    await db.churchLanguage.create({ data: { church_id: church.id, language_code } })
  }

  const serviceTimes = [
    { weekday: 7, local_time: new Date('1970-01-01T10:00:00Z'), label: 'Sunday Service' },
    { weekday: 3, local_time: new Date('1970-01-01T18:30:00Z'), label: 'Midweek Bible Study' },
  ]
  for (const st of serviceTimes) {
    await db.serviceTime.create({ data: { church_id: church.id, language_code: 'et', ...st } })
  }
}
