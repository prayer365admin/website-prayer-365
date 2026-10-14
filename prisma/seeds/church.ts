import { db } from '../../src/utils/db-connection'
import { DEMO_CHURCH_NAME, DEMO_CHURCH_NODE_NAME, getAdminUser } from './test-context'

// Second church for multi-church manual-testing (CH-04 selector needs >= 2
// churches under one scope). One CHURCH org node keeps the single-church
// account (prayer_church_admin) scoped to Tallinn only.
const SECOND_CHURCH_NAME = 'Tartu Demo Church'
const SECOND_CHURCH_NODE_NAME = 'Tartu Demo Church Node'

// Placeholder church + its languages + service times.
export const seedChurches = async () => {
  const existing = await db.church.findFirst({ where: { name: DEMO_CHURCH_NAME } })
  if (existing) {
    await db.church.update({
      where: { id: existing.id },
      data: { sunday_live_stream: true },
    })
    return
  }

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
      sunday_live_stream: true,
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

/** Second church (sibling CHURCH node) so global/diocese accounts get a selector. */
export const seedSecondChurch = async () => {
  const existing = await db.church.findFirst({ where: { name: SECOND_CHURCH_NAME } })
  if (existing) {
    await db.church.update({
      where: { id: existing.id },
      data: { taize_chants: true, youth_ministry: true },
    })
    return
  }

  const deanery = await db.orgNode.findFirst({
    where: { kind: 'DEANERY', name: 'Estonia Deanery' },
  })
  const admin = await getAdminUser()
  if (!deanery || !admin) throw new Error('seedSecondChurch: deanery node / admin missing')

  let node = await db.orgNode.findFirst({ where: { name: SECOND_CHURCH_NODE_NAME } })
  if (!node) {
    node = await db.orgNode.create({
      data: { kind: 'CHURCH', name: SECOND_CHURCH_NODE_NAME, parent_id: deanery.id },
    })
  }

  const church = await db.church.create({
    data: {
      org_node_id: node.id,
      name: SECOND_CHURCH_NAME,
      status: 'APPROVED',
      timezone: 'Europe/Tallinn',
      description: 'Second demo church for multi-church testing.',
      address: { line1: 'Riia 1', city: 'Tartu', countryCode: 'EE' },
      contacts: { email: 'tartu@example.com', phone: '+372****1111' },
      social_links: [],
      approved_by: admin.id,
      approved_at: new Date(),
      taize_chants: true,
      youth_ministry: true,
    },
  })

  await db.churchLanguage.create({ data: { church_id: church.id, language_code: 'et' } })

  const serviceTimes = [
    { weekday: 7, local_time: new Date('1970-01-01T09:00:00Z'), label: 'Sunday Service' },
  ]
  for (const st of serviceTimes) {
    await db.serviceTime.create({ data: { church_id: church.id, language_code: 'et', ...st } })
  }
}
