import { SiteMessageKey } from '@/i18n/messages'

// Topic chips follow the design until prayers carry a topic; they are display-only for now.
export const PRAYER_TOPIC_CHIPS: { label: SiteMessageKey; count: number }[] = [
  { label: 'prayerTopicMatins', count: 28 },
  { label: 'prayerTopicAngelus', count: 19 },
  { label: 'prayerTopicCompline', count: 34 },
  { label: 'prayerTopicPeace', count: 22 },
  { label: 'prayerTopicHealing', count: 15 },
  { label: 'prayerTopicFamilies', count: 12 },
]

// Community strip figures follow the design until streak and attendance tracking exist.
export const PRAYER_COMMUNITY = {
  streakDays: 24,
  streakGoal: 30,
  believersToday: 14820,
  parishes: 42,
}

const DAY = 24 * 60 * 60 * 1000

/** Sunday lectionary cycle (A/B/C). The church year starts on the first Sunday of Advent. */
export const lectionaryYear = (date: Date) => {
  const year = date.getUTCFullYear()
  const christmas = Date.UTC(year, 11, 25)
  // First Advent Sunday is the 4th Sunday before Christmas (22–28 days earlier).
  const advent = christmas - ((new Date(christmas).getUTCDay() || 7) + 21) * DAY
  const start = date.getTime() >= advent ? year : year - 1
  return ['A', 'B', 'C'][start % 3]
}

/** Reading time at a slow, prayerful pace. ponytail: estimate from the text; swap for audio duration once it is stored. */
export const readingMinutes = (text: string) =>
  Math.max(1, Math.round(text.trim().split(/\s+/).length / 150))
