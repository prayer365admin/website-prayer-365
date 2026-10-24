import { db } from '@/utils/db-connection'
import { SiteHabits } from '@/models/site-habits'

const DAY = 24 * 60 * 60 * 1000
const isoDay = (date: Date) => date.toISOString().slice(0, 10)

/**
 * Streak of consecutive days in `days` (unique YYYY-MM-DD, newest first) ending today or yesterday,
 * so a streak is not lost before today's first prayer listen.
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
 * Subject-only prayer-listening habits. Both figures come from the authenticated analytics intake:
 * prayer_listen records the first successful play in a page view, and prayer_listen_minute records
 * each full minute actually played. Calendar boundaries are UTC until user timezones are available.
 */
export const GET_MY_HABITS = async ({
  userId,
  now = new Date(),
}: {
  userId: string
  now?: Date
}): Promise<SiteHabits> => {
  const streakWindowStart = new Date(now.getTime() - 366 * DAY)
  const [listens, minutesThisWeek] = await Promise.all([
    db.analyticsEvent.findMany({
      where: {
        user_id: userId,
        event_type: 'prayer_listen',
        occurred_at: { gte: streakWindowStart, lte: now },
      },
      orderBy: { occurred_at: 'desc' },
      select: { occurred_at: true },
    }),
    db.analyticsEvent.count({
      where: {
        user_id: userId,
        event_type: 'prayer_listen_minute',
        occurred_at: { gte: weekStart(now), lte: now },
      },
    }),
  ])
  const listenDays = Array.from(new Set(listens.map((row) => isoDay(row.occurred_at))))
  return {
    streakDays: streakDays(listenDays, isoDay(now)),
    minutesThisWeek,
  }
}
