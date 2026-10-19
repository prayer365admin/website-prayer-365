/**
 * Sanctuary-hours parsing, shared by the public profile, the directory card and
 * the admin church-profile form.
 *
 * Storage format (unchanged, see website SPEC §5 / decision W14):
 * - a single block with time only  → plain string, e.g. `10:00–18:30 daily`
 * - several blocks                 → JSON array of { title, time, description }
 * - legacy multi-segment string    → blocks joined with ` • `, e.g.
 *   `Mon–Fri 10:00–18:30 • Sat 11:00–16:00 • Sun 09:00–19:00`
 *
 * Nothing here invents copy: a block only carries the text that was stored.
 */
export type SanctuaryScheduleItem = {
  title: string
  time: string
  description: string
}

export const DAILY_HOURS_TITLE = 'Daily Sanctuary Hours'

const TIME_RANGE = /(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/g

const DAY_NAMES: Array<[RegExp, number]> = [
  [/^(mon|monday)$/, 1],
  [/^(tue|tues|tuesday)$/, 2],
  [/^(wed|weds|wednesday)$/, 3],
  [/^(thu|thur|thurs|thursday)$/, 4],
  [/^(fri|friday)$/, 5],
  [/^(sat|saturday)$/, 6],
  [/^(sun|sunday)$/, 7],
]

/** Weekdays covered by a block label. `null` = no day restriction (every day). */
const weekdaysForTitle = (title: string): number[] | null => {
  const t = title.trim().toLowerCase()
  if (!t) return null
  if (/^mon(day)?\s*[–—-]\s*fri(day)?$/.test(t)) return [1, 2, 3, 4, 5]
  if (t.includes('sunday') || /\bsun\b/.test(t)) return [7]
  if (t.includes('saturday') || /\bsat\b/.test(t)) return [6]
  for (const [re, day] of DAY_NAMES) {
    if (re.test(t)) return [day]
  }
  return null
}

const normalizeTitle = (title: string): string => {
  const t = title.trim()
  if (t === 'Mon–Fri' || t === 'Mon-Fri' || t === 'Monday - Friday') return 'Monday - Friday'
  if (t === 'Sat' || t === 'Saturday') return 'Saturday'
  if (t === 'Sun' || t === 'Sunday') return 'LORD’S Day (Sunday)'
  return t
}

export function parseSanctuaryHours(raw: string | null | undefined): SanctuaryScheduleItem[] {
  if (!raw || !raw.trim()) return []
  const trimmed = raw.trim()

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: Record<string, unknown>) => ({
          title: String(item.title || ''),
          time: String(item.time || ''),
          description: String(item.description || ''),
        }))
      }
    } catch {
      // Fall through to string parsing
    }
  }

  if (trimmed.includes(' • ')) {
    return trimmed.split(' • ').map((part) => {
      const p = part.trim()
      const match = p.match(/^([A-Za-z\u2013\u2014\-’'\s]+)\s+([\d:–\- ]+)$/)
      if (match) {
        return { title: normalizeTitle(match[1]), time: match[2].trim(), description: '' }
      }
      return { title: p, time: '', description: '' }
    })
  }

  // A single segment may still carry a day label, e.g. `Sat 11:00–16:00`.
  const single = trimmed.match(/^([A-Za-z\u2013\u2014\-’'\s]+)\s+([\d:–\- ]+)$/)
  if (single) {
    return [{ title: normalizeTitle(single[1]), time: single[2].trim(), description: '' }]
  }

  return [{ title: DAILY_HOURS_TITLE, time: trimmed, description: '' }]
}

/** Back to the storage format: one time-only block stays a plain string. */
export function serializeSanctuaryHours(
  items: SanctuaryScheduleItem[] | null | undefined,
): string | null {
  const blocks = (items ?? [])
    .filter((b) => b && (b.title?.trim() || b.time?.trim()))
    .map((b) => ({
      title: b.title?.trim() || '',
      time: b.time?.trim() || '',
      description: b.description?.trim() || '',
    }))
  if (blocks.length === 0) return null
  if (blocks.length === 1 && blocks[0].title === DAILY_HOURS_TITLE && blocks[0].time) {
    return blocks[0].time
  }
  return JSON.stringify(blocks)
}

type MinuteRange = { start: number; end: number }

/** Every opening window in the stored schedule, ignoring the day labels. */
export function sanctuaryRanges(raw: string | null | undefined): MinuteRange[] {
  const ranges: MinuteRange[] = []
  for (const block of parseSanctuaryHours(raw)) {
    TIME_RANGE.lastIndex = 0
    let m = TIME_RANGE.exec(block.time)
    while (m) {
      const start = Number(m[1]) * 60 + Number(m[2])
      const end = Number(m[3]) * 60 + Number(m[4])
      if (end >= start) ranges.push({ start, end })
      m = TIME_RANGE.exec(block.time)
    }
  }
  return ranges
}

/** Opening windows that apply on `weekday` (1 = Monday … 7 = Sunday). */
export function sanctuaryRangesFor(raw: string | null | undefined, weekday: number): MinuteRange[] {
  const ranges: MinuteRange[] = []
  for (const block of parseSanctuaryHours(raw)) {
    const days = weekdaysForTitle(block.title)
    if (days && !days.includes(weekday)) continue
    TIME_RANGE.lastIndex = 0
    let m = TIME_RANGE.exec(block.time)
    while (m) {
      const start = Number(m[1]) * 60 + Number(m[2])
      const end = Number(m[3]) * 60 + Number(m[4])
      if (end >= start) ranges.push({ start, end })
      m = TIME_RANGE.exec(block.time)
    }
  }
  return ranges
}

/** Latest closing time in the schedule (`10:00–18:30 daily` → `18:30`). */
export function closingTime(raw: string | null | undefined): string | null {
  if (!raw) return null
  const closings: string[] = []
  const re = /(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/g
  let m = re.exec(raw)
  while (m) {
    closings.push(m[2])
    m = re.exec(raw)
  }
  if (closings.length === 0) return null
  return closings.sort((a, b) => b.localeCompare(a))[0]
}
