import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'

import {
  ENQUEUE_NOTIFICATION,
  GET_NOTIFICATION_RULE_BY_TYPE,
  LIST_APPROVED_CHURCH_IDS,
  SCAN_EVENTS_STARTING_BETWEEN,
} from '@/providers/notification'
import { logger } from '@/utils/logger'

/*
 * Notification producers that fire on a calendar instead of an admin action
 * (F12): event reminders and the donation-reminder recurrence.
 *
 * Both sweeps are idempotent: the dedupe key encodes the period (event+offset,
 * church+period), so a repeated tick — or a replayed dispatcher run — inserts
 * nothing. Individual failures are logged and never block the sweep.
 */

dayjs.extend(isoWeek)

/**
 * Monthly periods are calendar months; weekly periods are ISO weeks
 * (`YYYY-Www`). dayjs has no week format token, so the ISO number is read
 * directly — week 1 of a year can start in the previous December.
 */
const donationPeriodKey = (recurrence: 'weekly' | 'monthly', now: Date) => {
  if (recurrence === 'monthly') return dayjs(now).format('YYYY-MM')
  const week = String(dayjs(now).isoWeek()).padStart(2, '0')
  return `${dayjs(now).isoWeekYear()}-W${week}`
}

export const scanDueEventReminders = async ({ now = new Date() }: { now?: Date } = {}): Promise<{
  enqueued: number
}> => {
  const rule = await GET_NOTIFICATION_RULE_BY_TYPE({ type: 'event_reminder' })
  if (!rule || !rule.enabled || rule.offset_minutes == null) return { enqueued: 0 }

  const offset = rule.offset_minutes
  const windowMs = offset * 60_000
  const events = await SCAN_EVENTS_STARTING_BETWEEN({
    from: now,
    to: new Date(now.getTime() + windowMs),
  })

  let enqueued = 0
  for (const event of events) {
    try {
      await ENQUEUE_NOTIFICATION({
        type: 'event_reminder',
        resourceId: event.id,
        churchId: event.church_id,
        dedupeKeySuffix: `${event.id}:${offset}`,
        // Reminder goes out `offset` before the event starts.
        availableAt: new Date(event.starts_at.getTime() - windowMs),
      })
      enqueued++
    } catch {
      // Already enqueued for this event+offset (dedupe) or a transient write error.
    }
  }
  return { enqueued }
}

export const scanDueDonationReminders = async ({ now = new Date() }: { now?: Date } = {}): Promise<{
  enqueued: number
}> => {
  const rule = await GET_NOTIFICATION_RULE_BY_TYPE({ type: 'donation_reminder' })
  const recurrence = rule?.recurrence
  if (!rule || !rule.enabled || (recurrence !== 'weekly' && recurrence !== 'monthly')) {
    return { enqueued: 0 }
  }

  const periodKey = donationPeriodKey(recurrence, now)
  const churches = await LIST_APPROVED_CHURCH_IDS()

  let enqueued = 0
  for (const church of churches) {
    try {
      await ENQUEUE_NOTIFICATION({
        type: 'donation_reminder',
        resourceId: church.id,
        churchId: church.id,
        // One reminder per church per period, however often the sweep runs.
        dedupeKeySuffix: `${church.id}:${periodKey}`,
      })
      enqueued++
    } catch {
      // Already enqueued for this church+period.
    }
  }
  if (enqueued > 0) {
    logger.info('donation_reminders_enqueued', { period: periodKey, count: enqueued })
  }
  return { enqueued }
}
