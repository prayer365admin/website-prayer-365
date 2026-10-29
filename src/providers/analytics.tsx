import { db } from '@/utils/db-connection'
import { CUSTOMER_ACCOUNT_FILTER } from '@/utils/customer-role'
import {
  AnalyticsMetrics,
  AttendanceSummary,
  DonationTotal,
  RegionSummary,
} from '@/models/analytics'

/*
 * Analytics adapter (Tasks 31-32). All metrics derive from SOURCE records:
 * CheckIn (voluntary attendance), Event (church events), Prayer (content),
 * Donation (payments attributed to the church). Client
 * analytics-events are NOT an attendance source. Every read is filtered by
 * the resolved `churchIds` for both count and rows, attendance is aggregated
 * by local date (no named records), and the regional summary is aggregate
 * only — never private request rows, never raw donor rows.
 */

const countDistinctUsers = async ({
  churchIds,
  from,
  to,
}: {
  churchIds: Set<string>
  from: Date | null
  to: Date | null
}): Promise<number> => {
  const ids = Array.from(churchIds)
  if (ids.length === 0) return 0
  const rows = await db.checkIn.groupBy({
    by: ['user_id'],
    where: {
      church_id: { in: ids },
      occurred_at: { gte: from ?? undefined, lte: to ?? undefined },
      user_id: { not: null },
    },
  })
  return rows.length
}

/** Aggregate donor gross per currency; never combined across currencies. */
const grossByCurrency = async ({
  churchIds,
  from,
  to,
}: {
  churchIds: Set<string>
  from: Date | null
  to: Date | null
}): Promise<DonationTotal[]> => {
  const ids = Array.from(churchIds)
  if (ids.length === 0) return []
  const grouped = await db.donation.groupBy({
    by: ['currency'],
    where: {
      church_id: { in: ids },
      paid_at: { gte: from ?? undefined, lte: to ?? undefined },
    },
    _sum: { amount_minor: true },
  })
  return grouped
    .map((g) => ({
      currency: g.currency,
      grossMinor: (g._sum?.amount_minor ?? BigInt(0)).toString(),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

export const GET_ANALYTICS = async ({
  churchIds,
  from,
  to,
}: {
  churchIds: Set<string>
  from: Date | null
  to: Date | null
}): Promise<AnalyticsMetrics> => {
  const ids = Array.from(churchIds)
  if (ids.length === 0) {
    return {
      from,
      to,
      checkInCount: 0,
      eventCount: 0,
      prayerCount: 0,
      donationCount: 0,
      activeMembers: 0,
    }
  }
  const range = { gte: from ?? undefined, lte: to ?? undefined }
  const [checkInCount, eventCount, prayerCount, donationCount] = await db.$transaction([
    db.checkIn.count({ where: { church_id: { in: ids }, occurred_at: range } }),
    db.event.count({ where: { church_id: { in: ids }, starts_at: range } }),
    db.prayer.count({ where: { church_id: { in: ids }, created_at: range } }),
    db.donation.count({ where: { church_id: { in: ids }, paid_at: range } }),
  ])
  const activeMembers = await countDistinctUsers({ churchIds, from, to })
  return { from, to, checkInCount, eventCount, prayerCount, donationCount, activeMembers }
}

export const GET_ATTENDANCE_SUMMARY = async ({
  churchIds,
  from,
  to,
}: {
  churchIds: Set<string>
  from: Date | null
  to: Date | null
}): Promise<AttendanceSummary> => {
  const ids = Array.from(churchIds)
  if (ids.length === 0) return { from, to, days: [] }
  const grouped = await db.checkIn.groupBy({
    by: ['local_date'],
    where: {
      church_id: { in: ids },
      occurred_at: { gte: from ?? undefined, lte: to ?? undefined },
    },
    _count: { _all: true },
    orderBy: { local_date: 'asc' },
  })
  return {
    from,
    to,
    days: grouped.map((g) => ({
      date: g.local_date.toISOString().slice(0, 10),
      count: g._count._all,
    })),
  }
}

/** Regional aggregate over the descendant church set (aggregate only). */
export const GET_REGION_SUMMARY = async ({
  regionId,
  churchIds,
  from,
  to,
}: {
  regionId: string
  churchIds: Set<string>
  from: Date | null
  to: Date | null
}): Promise<RegionSummary> => {
  const ids = Array.from(churchIds)
  if (ids.length === 0) {
    return {
      regionId,
      from,
      to,
      churchCount: 0,
      memberCount: 0,
      activeMembers: 0,
      checkInCount: 0,
      eventCount: 0,
      prayerCount: 0,
      donationCount: 0,
      totalGrossByCurrency: [],
    }
  }
  const range = { gte: from ?? undefined, lte: to ?? undefined }
  const [memberCount, checkInCount, eventCount, prayerCount, donationCount] = await db.$transaction(
    [
      db.userChurch.count({ where: { church_id: { in: ids }, user: CUSTOMER_ACCOUNT_FILTER } }),
      db.checkIn.count({ where: { church_id: { in: ids }, occurred_at: range } }),
      db.event.count({ where: { church_id: { in: ids }, starts_at: range } }),
      db.prayer.count({ where: { church_id: { in: ids }, created_at: range } }),
      db.donation.count({ where: { church_id: { in: ids }, paid_at: range } }),
    ],
  )
  const [activeMembers, totalGrossByCurrency] = await Promise.all([
    countDistinctUsers({ churchIds, from, to }),
    grossByCurrency({ churchIds, from, to }),
  ])
  return {
    regionId,
    from,
    to,
    churchCount: ids.length,
    memberCount,
    activeMembers,
    checkInCount,
    eventCount,
    prayerCount,
    donationCount,
    totalGrossByCurrency,
  }
}
