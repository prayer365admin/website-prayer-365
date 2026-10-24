export { prayerDurationMinutes, readingMinutes } from '@/utils/prayer-duration'

const DAY = 24 * 60 * 60 * 1000

/** Sunday lectionary cycle (A/B/C), retained for non-archive calendar consumers. */
export const lectionaryYear = (date: Date) => {
  const year = date.getUTCFullYear()
  const christmas = Date.UTC(year, 11, 25)
  const advent = christmas - ((new Date(christmas).getUTCDay() || 7) + 21) * DAY
  const start = date.getTime() >= advent ? year : year - 1
  return ['A', 'B', 'C'][start % 3]
}
