import { SEND_HOUR_LOCAL } from '@/config/general-prayer'
import { todayInTallinn, sequenceFor, tallinnLocalToUtc } from '@/utils/general-prayer-cycle'
import {
  COUNT_ACTIVE_GENERAL_PRAYERS,
  ENQUEUE_GENERAL_PRAYER_SEND_JOB,
  GET_GENERAL_PRAYER_BY_SEQUENCE,
} from '@/providers/general-prayer'
import { logger } from '@/utils/logger'

/*
 * Daily General Prayer producer (GP-JOB-S-02).
 *
 * Runs on every dispatcher tick (1 minute). Before the local send hour it does
 * nothing; at/after it, the date resolves to a cycle position and one outbox
 * row is created. `dedupe_key = general_prayer.send:<YYYY-MM-DD>` is unique, so
 * the ~1 380 remaining ticks of the day insert nothing — the exact-one-per-day
 * guarantee is the database, not an in-memory check.
 *
 * A late 07:00 tick still sends today's prayer (catch-up after a dispatcher
 * gap); the row is scheduled for the send instant, not for tick time.
 */

export const scanDueGeneralPrayer = async ({ now = new Date() }: { now?: Date } = {}): Promise<{
  enqueued: number
}> => {
  const { dateISO, hour } = todayInTallinn(now)
  if (hour < SEND_HOUR_LOCAL) return { enqueued: 0 }

  const count = await COUNT_ACTIVE_GENERAL_PRAYERS()
  if (count === 0) return { enqueued: 0 }

  const sequence = sequenceFor(dateISO, count)
  const row = await GET_GENERAL_PRAYER_BY_SEQUENCE({ sequence })
  if (!row) {
    // The position exists in the cycle length but its row is gone: nothing to send.
    logger.warn('general_prayer_send_no_row', { date: dateISO, sequence })
    return { enqueued: 0 }
  }

  const created = await ENQUEUE_GENERAL_PRAYER_SEND_JOB({
    dateISO,
    generalPrayerId: row.id,
    availableAt: tallinnLocalToUtc(dateISO, SEND_HOUR_LOCAL),
  })
  if (created.count > 0) {
    logger.info('general_prayer_send_enqueued', { date: dateISO, sequence })
  }
  return { enqueued: created.count }
}
