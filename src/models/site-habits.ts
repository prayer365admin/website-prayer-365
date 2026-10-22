/** Spiritual Habits figures for the website Home (signed-in customer only). */
export type SiteHabits = {
  /** Consecutive days with a successful prayer play, ending today or yesterday. */
  streakDays: number
  /** Minutes of prayer audio played since Monday 00:00 UTC (one prayer_listen_minute event each). */
  minutesThisWeek: number
}
