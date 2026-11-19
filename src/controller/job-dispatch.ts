/*
 * Job dispatcher (SPEC §10.3): claims due outbox rows and forwards references to
 * SQS. Runs as an EventBridge-scheduled Lambda in production and is unit-tested
 * with the provider seams mocked.
 *
 * NOTE (layer law): this scheduler is the one place a controller imports another
 * controller. `prayer.publish` needs its due-date sweep before claiming, and
 * `notification.send` needs its calendar sweeps (event reminders, donation
 * recurrence); each sweep must have exactly one implementation. Business
 * controllers stay free of controller-to-controller imports.
 */
import { CLAIM_PENDING_JOBS } from '@/providers/outbox-job'
import { SQS_SEND_JOB } from '@/providers/sqs'
import { scanDueScheduledPrayers } from '@/controller/prayer-publish-job'
import { scanDueDonationReminders, scanDueEventReminders } from '@/controller/notification-schedule'
import { scanDueGeneralPrayer } from '@/controller/general-prayer-schedule'
import { logger } from '@/utils/logger'

/**
 * Job kinds the consumer can actually process. Every producer must have a
 * matching processXJob here, or the row stays PENDING forever.
 */
export const SUPPORTED_KINDS = [
  'audio.generate',
  'prayer.publish',
  'payment.sync',
  'voice.register',
  'mail.send',
  'notification.send',
  'general_prayer.audio',
  'general_prayer.send',
  'donation_reminder.send',
] as const

export type JobKind = (typeof SUPPORTED_KINDS)[number]

export type DispatchSummary = {
  scanned: number
  byKind: Record<string, number>
}

export type CalendarSweepSummary = {
  enqueued: number
  bySweep: Record<string, number>
}

/**
 * The calendar producers: everything that turns a date into an outbox row.
 *
 * Shared by the dispatcher Lambda (which then claims and forwards to SQS) and
 * `workers/scheduler.ts` (local dev, where there is no SQS and therefore no
 * dispatcher). One implementation per sweep is the point — a second copy would
 * drift and fire at a different hour.
 */
export const runCalendarSweeps = async ({
  now,
}: { now?: Date } = {}): Promise<CalendarSweepSummary> => {
  const scheduled = await scanDueScheduledPrayers()
  const events = await scanDueEventReminders({ now })
  const donations = await scanDueDonationReminders({ now })
  const daily = await scanDueGeneralPrayer({ now })

  return {
    enqueued: scheduled.enqueued + events.enqueued + donations.enqueued + daily.enqueued,
    bySweep: {
      'prayer.publish': scheduled.enqueued,
      event_reminder: events.enqueued,
      donation_reminder: donations.enqueued,
      general_prayer: daily.enqueued,
    },
  }
}

const claimLimit = () => {
  const raw = Number(process.env.JOB_CLAIM_LIMIT ?? 10)
  return Number.isFinite(raw) && raw >= 1 ? raw : 10
}

const leaseSeconds = () => {
  const raw = Number(process.env.JOB_LEASE_SECONDS ?? 900)
  return Number.isFinite(raw) && raw >= 1 ? raw : 900
}

/**
 * One dispatcher run: turn due outbox rows into SQS messages.
 *
 * The claim happens BEFORE the send on purpose — the row becomes RUNNING with a
 * lease, so a second dispatcher run cannot pick up the same job while the
 * message is in flight. Duplicate SQS delivery is absorbed by the consumer,
 * because every processXJob re-reads the row and skips anything not RUNNING.
 */
export const runDispatcher = async (): Promise<DispatchSummary> => {
  const queueUrl = process.env.JOBS_QUEUE_URL
  if (!queueUrl) throw new Error('JOBS_QUEUE_URL is not set')

  const limit = claimLimit()
  const lease = leaseSeconds()
  const byKind: Record<string, number> = {}

  // Every calendar producer runs before the first claim, so a row it creates can
  // be dispatched on the same tick instead of the next one.
  const sweeps = await runCalendarSweeps()
  const scanned = sweeps.enqueued

  for (const kind of SUPPORTED_KINDS) {
    const claimed = await CLAIM_PENDING_JOBS({ kind, limit, leaseSeconds: lease })
    for (const job of claimed) {
      await SQS_SEND_JOB({ queueUrl, kind, jobId: job.id })
    }
    byKind[kind] = claimed.length
  }

  const summary = { scanned, byKind }
  logger.info('job_dispatch_tick', summary)
  return summary
}
