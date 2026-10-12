import { Prisma } from '@prisma/client'
import { db } from '../../src/utils/db-connection'
import { getDemoChurch, getAdminUser } from './test-context'

// Placeholder requests at the demo church, one per visibility case: a PRIVATE
// prayer, a STANDARD prayer, and the always-restricted pastoral and meeting
// kinds. Sample content only. Each row is created once, keyed by subject.
const SAMPLES: Omit<Prisma.RequestUncheckedCreateInput, 'church_id' | 'user_id'>[] = [
  {
    kind: 'PRAYER',
    subject: 'Demo prayer request',
    message: 'Demo request body.',
    classification: 'PRIVATE',
    contact_method: 'email',
    email: 'demo@example.com',
  },
  {
    kind: 'PRAYER',
    subject: 'Demo standard prayer request',
    message: 'Please pray for our community event.',
    classification: 'STANDARD',
    contact_method: 'email',
    email: 'standard@example.com',
  },
  {
    kind: 'PASTORAL',
    subject: 'Speak with a pastor',
    message: 'I would like to talk with a pastor.',
    contact_method: 'phone',
    phone: '+372 5555 0000',
    availability: 'Weekday evenings',
  },
  {
    kind: 'MEETING',
    subject: 'Meeting request',
    message: 'Could we meet after the Sunday service?',
    contact_method: 'email',
    email: 'meeting@example.com',
    availability: 'Saturday mornings',
  },
]

export const seedRequests = async () => {
  const church = await getDemoChurch()
  const user = await getAdminUser()
  if (!church) throw new Error('seedRequests: demo church missing')
  for (const sample of SAMPLES) {
    const existing = await db.request.findFirst({
      where: { church_id: church.id, subject: sample.subject },
    })
    if (existing) continue
    await db.request.create({
      data: { ...sample, church_id: church.id, user_id: user?.id ?? null },
    })
  }
}
