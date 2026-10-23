import { richTextToPlainText } from '@/utils/rich-text-plain'

const DAY = 24 * 60 * 60 * 1000

/** Sunday lectionary cycle (A/B/C), retained for non-archive calendar consumers. */
export const lectionaryYear = (date: Date) => {
  const year = date.getUTCFullYear()
  const christmas = Date.UTC(year, 11, 25)
  const advent = christmas - ((new Date(christmas).getUTCDay() || 7) + 21) * DAY
  const start = date.getTime() >= advent ? year : year - 1
  return ['A', 'B', 'C'][start % 3]
}

/** Reading time at a slow, prayerful pace. ponytail: estimate from the text; swap for audio duration once it is stored. */
export const readingMinutes = (text: string) =>
  Math.max(1, Math.round(richTextToPlainText(text).split(/\s+/).length / 150))
