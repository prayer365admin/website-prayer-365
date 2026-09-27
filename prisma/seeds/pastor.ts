import { db } from '../../src/utils/db-connection'
import { DEMO_PASTOR_NAME, getDemoChurch, getPastorUser } from './test-context'

// Placeholder pastor linked to the demo church (church_pastor assignment).
export const seedPastors = async () => {
  const pastorUser = await getPastorUser()
  const church = await getDemoChurch()
  if (!church) throw new Error('seedPastors: demo church missing')

  const byName = await db.pastor.findFirst({ where: { name: DEMO_PASTOR_NAME } })
  const byUser = pastorUser
    ? await db.pastor.findUnique({ where: { user_id: pastorUser.id } })
    : null
  let pastor = byName ?? byUser

  if (!pastor) {
    const created = await db.pastor.create({
      data: {
        user_id: pastorUser?.id ?? null,
        name: DEMO_PASTOR_NAME,
        introduction: 'Demo pastor for testing.',
      },
    })
    pastor = created
  }

  const link = await db.churchPastor.findUnique({
    where: { church_id_pastor_id: { church_id: church.id, pastor_id: pastor.id } },
  })
  if (!link) {
    await db.churchPastor.create({
      data: { church_id: church.id, pastor_id: pastor.id, pastoral_role: 'Senior Pastor' },
    })
  }
}
