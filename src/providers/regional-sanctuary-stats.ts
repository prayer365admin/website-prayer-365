import { RegionalSanctuaryStats } from '@/models/regional-sanctuary-stats'
import { db } from '@/utils/db-connection'

/** Current public network totals shown during customer registration. */
export const GET_REGIONAL_SANCTUARY_STATS = async (): Promise<RegionalSanctuaryStats> => {
  const [approvedChurches, dioceses] = await db.$transaction([
    db.church.count({ where: { status: 'APPROVED' } }),
    db.orgNode.count({ where: { kind: 'DIOCESE' } }),
  ])

  return { approvedChurches, dioceses }
}
