import dayjs, { Dayjs } from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(customParseFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

export const EVENT_EDITOR_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm'
export const EVENT_TABLE_DATETIME_FORMAT = 'DD MMM YYYY, HH:mm'

export type EventDateTimeErrorCode =
  | 'INVALID_TIMEZONE'
  | 'INVALID_LOCAL_TIME'
  | 'NONEXISTENT_LOCAL_TIME'
  | 'AMBIGUOUS_LOCAL_TIME'

export type EventDateTimeFailure = {
  ok: false
  code: EventDateTimeErrorCode
  message: string
}

export type EventDateTimeResult = { ok: true; iso: string } | EventDateTimeFailure

const validTimezone = (timezoneName: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezoneName }).format(0)
    return true
  } catch {
    return false
  }
}

const invalidTimezone = (timezoneName: string): EventDateTimeFailure => ({
  ok: false,
  code: 'INVALID_TIMEZONE',
  message: `The church timezone "${timezoneName}" is not valid.`,
})

/**
 * Returns each real instant that renders as the requested wall-clock minute.
 * Sampling offsets around the date discovers both sides of a timezone
 * transition without relying on Day.js's normalization choice.
 */
const matchingInstants = (wallTime: string, timezoneName: string): Dayjs[] => {
  const parsed = dayjs.utc(wallTime, EVENT_EDITOR_DATETIME_FORMAT, true)
  const wallUtc = Date.UTC(
    parsed.year(),
    parsed.month(),
    parsed.date(),
    parsed.hour(),
    parsed.minute(),
  )
  const offsets = new Set<number>()
  const sampleWindowHours = 48
  const sampleStepHours = 6

  for (let hours = -sampleWindowHours; hours <= sampleWindowHours; hours += sampleStepHours) {
    offsets.add(dayjs.utc(wallUtc).add(hours, 'hour').tz(timezoneName).utcOffset())
  }

  const matches = new Map<number, Dayjs>()
  for (const offsetMinutes of Array.from(offsets)) {
    const candidate = dayjs.utc(wallUtc - offsetMinutes * 60_000).tz(timezoneName)
    if (candidate.format(EVENT_EDITOR_DATETIME_FORMAT) === wallTime) {
      matches.set(candidate.valueOf(), candidate)
    }
  }
  return Array.from(matches.values()).sort((left, right) => left.valueOf() - right.valueOf())
}

/**
 * Converts the wall-clock value selected in the Event editor to an ISO value
 * with an explicit church offset. Invalid DST gaps and ambiguous overlaps are
 * returned to the form as validation results instead of being normalized.
 */
export const churchDateTimeToEventInstant = (
  localValue: Dayjs | string,
  timezoneName: string,
): EventDateTimeResult => {
  if (!validTimezone(timezoneName)) return invalidTimezone(timezoneName)

  const wallTime =
    typeof localValue === 'string'
      ? localValue.trim()
      : localValue.isValid()
        ? localValue.format(EVENT_EDITOR_DATETIME_FORMAT)
        : ''
  const parsed = dayjs.utc(wallTime, EVENT_EDITOR_DATETIME_FORMAT, true)
  if (!parsed.isValid() || parsed.format(EVENT_EDITOR_DATETIME_FORMAT) !== wallTime) {
    return {
      ok: false,
      code: 'INVALID_LOCAL_TIME',
      message: `Enter the event date and time as ${EVENT_EDITOR_DATETIME_FORMAT}.`,
    }
  }

  const matches = matchingInstants(wallTime, timezoneName)
  if (matches.length === 0) {
    return {
      ok: false,
      code: 'NONEXISTENT_LOCAL_TIME',
      message:
        'This local time does not exist because the church clock moves forward. Choose another time.',
    }
  }
  if (matches.length > 1) {
    return {
      ok: false,
      code: 'AMBIGUOUS_LOCAL_TIME',
      message:
        'This time happens twice on that date because the church clock moves back an hour (the same wall-clock time exists at two different moments). Choose a time outside the repeated hour.',
    }
  }

  return { ok: true, iso: matches[0].format('YYYY-MM-DDTHH:mm:ssZ') }
}

/** Converts a stored absolute instant into a Day.js value in the church zone. */
export const eventInstantToChurchDateTime = (startsAt: string, timezoneName: string): Dayjs => {
  if (!validTimezone(timezoneName)) throw new Error(invalidTimezone(timezoneName).message)
  const instant = dayjs.utc(startsAt)
  if (!instant.isValid()) throw new Error('The stored event start time is not valid.')
  return instant.tz(timezoneName)
}

export const formatEventStart = (startsAt: string, timezoneName: string): string =>
  eventInstantToChurchDateTime(startsAt, timezoneName).format(EVENT_TABLE_DATETIME_FORMAT)

/** Filter bound: church-local wall time to an instant. DST gaps/overlaps need no rejection here. */
export const churchFilterBoundToIso = (local: Dayjs, timezoneName: string): string =>
  dayjs.tz(local.format(EVENT_EDITOR_DATETIME_FORMAT), timezoneName).toISOString()

export type EventStartStatus = { label: string; color: string } | null

/**
 * Admin hint for an event's start relative to now, counted in church-local days.
 * Within 3 days is urgent, within 7 days is a heads-up, earlier events are "Past".
 */
export const eventStartStatus = (
  startsAt: string,
  timezoneName: string,
  now: Dayjs = dayjs(),
): EventStartStatus => {
  const start = eventInstantToChurchDateTime(startsAt, timezoneName)
  if (start.isBefore(now)) return { label: 'Past', color: 'default' }
  const days = start.startOf('day').diff(now.tz(timezoneName).startOf('day'), 'day')
  if (days === 0) return { label: 'Today', color: 'red' }
  if (days === 1) return { label: 'Tomorrow', color: 'red' }
  if (days <= 3) return { label: `In ${days} days`, color: 'orange' }
  if (days <= 7) return { label: `In ${days} days`, color: 'gold' }
  return null
}

/** "UTC+02:00" for the offset the selected church-local time resolves to; null while invalid. */
export const eventOffsetLabel = (local: Dayjs | undefined, timezoneName: string): string | null => {
  if (!local) return null
  const result = churchDateTimeToEventInstant(local, timezoneName)
  return result.ok ? `UTC${result.iso.slice(-6)}` : null
}
