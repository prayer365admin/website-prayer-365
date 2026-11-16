import { CYCLE_ANCHOR, SEND_HOUR_LOCAL, SEND_TIMEZONE } from '@/config/general-prayer'

/*
 * Date <-> cycle-position maths for the General Prayer (GP-DB-02, §7).
 *
 * Everything here works on `YYYY-MM-DD` calendar strings, so a "day" is always
 * 86 400 000 ms of UTC: DST never shortens or lengthens a cycle step (R6).
 * The local clock is read through Intl, never through a fixed UTC offset.
 */

const DAY_MS = 86_400_000

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

type DateParts = { year: number; month: number; day: number }

/** Parse and validate a `YYYY-MM-DD` calendar date (29 Feb is a real date). */
const parseDateISO = (dateISO: string): DateParts => {
  const match = ISO_DATE.exec(dateISO)
  if (!match) throw new Error(`Invalid date, expected YYYY-MM-DD: ${dateISO}`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${dateISO}`)
  }
  return { year, month, day }
}

const utcMidnight = ({ year, month, day }: DateParts) => Date.UTC(year, month - 1, day)

const toISO = ({ year, month, day }: DateParts) =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/** Whole calendar days from `fromISO` to `toISO` (negative when `toISO` is earlier). */
export const daysBetween = (fromISO: string, toISO: string) =>
  Math.round((utcMidnight(parseDateISO(toISO)) - utcMidnight(parseDateISO(fromISO))) / DAY_MS)

/** `dateISO` shifted by whole calendar days. */
export const addDays = (dateISO: string, days: number): string => {
  const { year, month, day } = parseDateISO(dateISO)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return toISO({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  })
}

/**
 * Cycle position (1..`count`) for a calendar date.
 *
 * `sequenceFor(anchor) === 1`, the next day is 2, the day after position
 * `count` wraps back to 1, and dates before the anchor wrap backwards.
 */
export const sequenceFor = (
  dateISO: string,
  count: number,
  anchorISO: string = CYCLE_ANCHOR,
): number => {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`Cycle length must be a positive integer, received: ${count}`)
  }
  const offset = daysBetween(anchorISO, dateISO)
  return (((offset % count) + count) % count) + 1
}

const localFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: SEND_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const localParts = (instant: Date) => {
  const parts: Record<string, string> = {}
  for (const part of localFormat.formatToParts(instant)) parts[part.type] = part.value
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  }
}

/** Calendar date + local hour right now, in the send timezone. */
export const todayInTallinn = (now: Date = new Date()): { dateISO: string; hour: number } => {
  const { year, month, day, hour } = localParts(now)
  return { dateISO: toISO({ year, month, day }), hour }
}

/**
 * The UTC instant of a wall-clock time in the send timezone.
 *
 * Two correction passes: the first guesses UTC, measures the real offset at
 * that instant, the second fixes the residual (a wall-clock time that only
 * exists on one side of a DST shift).
 */
export const tallinnLocalToUtc = (dateISO: string, hour: number, minute = 0): Date => {
  const { year, month, day } = parseDateISO(dateISO)
  const target = Date.UTC(year, month - 1, day, hour, minute)
  let guess = target
  for (let pass = 0; pass < 2; pass += 1) {
    const local = localParts(new Date(guess))
    const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute)
    guess += target - localAsUtc
  }
  return new Date(guess)
}

/**
 * Next send boundary at or after `now` (the mobile contract's `nextResetAt`).
 * Before today's send hour it is today's; otherwise tomorrow's.
 */
export const nextSendAt = (now: Date = new Date()): Date => {
  const { dateISO } = todayInTallinn(now)
  const todaySend = tallinnLocalToUtc(dateISO, SEND_HOUR_LOCAL)
  if (todaySend.getTime() > now.getTime()) return todaySend
  return tallinnLocalToUtc(addDays(dateISO, 1), SEND_HOUR_LOCAL)
}
