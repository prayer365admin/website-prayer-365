import { db } from '../../src/utils/db-connection'
import { getDemoChurch, getAdminUser } from './test-context'

// Placeholder private prayer request.
export const seedRequests = async () => {
  const existing = await db.request.findFirst({})
  if (existing) return
  const church = await getDemoChurch()
  const user = await getAdminUser()
  if (!church) throw new Error('seedRequests: demo church missing')
  await db.request.create({
    data: {
      church_id: church.id,
      user_id: user?.id ?? null,
      kind: 'PRAYER',
      subject: 'Demo prayer request',
      message: 'Demo request body.',
      classification: 'PRIVATE',
      contact_method: 'email',
      email: 'demo@example.com',
    },
  })
}
