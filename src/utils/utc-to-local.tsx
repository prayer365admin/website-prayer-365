import dayjs, { Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * Converts a UTC date to a local date in the specified format.
 * @param {string | Dayjs} date - The UTC date string or Dayjs object.
 * @param {string} format - The desired date format.
 * @returns {string} - The formatted local date string.
 */
export const utcToLocal = (
  date: string | Dayjs,
  format: string = 'DD/MM/YYYY',
  defaultTimezone: string = 'Asia/Singapore',
): string => {
  return dayjs.utc(date).tz(defaultTimezone).format(format)
}
