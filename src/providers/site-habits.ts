import { db } from '@/utils/db-connection'
import { SiteHabits } from '@/models/site-habits'

const DAY = 24 * 60 * 60 * 1000
const isoDay = (date: Date) => date.toISOString().slice(0, 10)

/**
 * Streak of consecutive days in `days` (unique YYYY-MM-DD, newest first) ending today or yesterday,
 * so a streak is not lost before today's check-in.
 */
export const streakDays = (days: string[], today: string) => {
  let expected = days[0] === today ? today : isoDay(new Date(Date.parse(today) - DAY))
  let streak = 0
  for (const day of days) {
    if (day !== expected) break
    streak++
    expected = isoDay(new Date(Date.parse(expected) - DAY))
  }
  return streak
}

/** Monday 00:00 UTC of the week containing `now`. */
export const weekStart = (now: Date) => {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return new Date(midnight - ((now.getUTCDay() + 6) % 7) * DAY)
}

/**
 * Subject-only habit figures. ponytail: check-in local_date is the church's local day while
 * "today" is UTC, so a streak can read one day short around midnight; pass the user's zone if that matters.
 */
export const GET_MY_HABITS = async ({
  userId,
  now = new Date(),
}: {
  userId: string
  now?: Date
}): Promise<SiteHabits> => {
  const [checkIns, minutesThisWeek] = await Promise.all([
    db.checkIn.findMany({
      where: { user_id: userId },
      distinct: ['local_date'],
      orderBy: { local_date: 'desc' },
      take: 366,
      select: { local_date: true },
    }),
    db.analyticsEvent.count({
      where: {
        user_id: userId,
        event_type: 'prayer_listen_minute',
        occurred_at: { gte: weekStart(now) },
      },
    }),
  ])
  return {
    streakDays: streakDays(
      checkIns.map((row) => isoDay(row.local_date)),
      isoDay(now),
    ),
    minutesThisWeek,
  }
}
