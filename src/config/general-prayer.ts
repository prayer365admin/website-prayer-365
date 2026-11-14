/*
 * General Prayer cycle configuration (GP-DB-02 / GP-OPS-01).
 *
 * The platform sends one prayer per calendar day at a fixed local hour. The
 * content is a repeating cycle over the active general prayers, so the only
 * inputs are an anchor date, the local hour, and the timezone.
 */

/**
 * Cycle position 1 falls on this date (Europe/Tallinn). Defaults to the first
 * day of the delivered content; an override lets the client re-anchor the
 * cycle without a deploy once the full 365-day list arrives.
 */
export const CYCLE_ANCHOR = process.env.GENERAL_PRAYER_CYCLE_ANCHOR || '2026-11-12'

/** Local hour the daily send happens (everyone at the same moment, D-GP-2). */
export const SEND_HOUR_LOCAL = 7

/** Never a fixed UTC offset: Europe/Tallinn shifts twice a year (R6). */
export const SEND_TIMEZONE = 'Europe/Tallinn'

const positiveInt = (raw: string | undefined, fallback: number) => {
  const value = Number(raw)
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback
}

/** Recipients handled per job attempt before the job requeues with a cursor (R5). */
export const SEND_CHUNK = positiveInt(process.env.GENERAL_PRAYER_SEND_CHUNK, 500)

/** TTS attempts before an audio job is finalized FAILED (GP-JOB-A-04). */
export const AUDIO_MAX_ATTEMPTS = positiveInt(process.env.GENERAL_PRAYER_AUDIO_MAX_ATTEMPTS, 3)
