/*
 * Job dispatcher (SPEC §10.3): claims due outbox rows and forwards references to
 * SQS. Runs as an EventBridge-scheduled Lambda in production and is unit-tested
 * with the provider seams mocked.
 *
 * NOTE (layer law): this scheduler is the one place a controller imports another
 * controller. `prayer.publish` needs its due-date sweep before claiming, and that
 * sweep must have exactly one implementation. Business controllers stay free of
 * controller-to-controller imports.
 */
import { CLAIM_PENDING_JOBS } from '@/providers/outbox-job'
import { SQS_SEND_JOB } from '@/providers/sqs'
import { scanDueScheduledPrayers } from '@/controller/prayer-publish-job'
import { logger } from '@/utils/logger'

/**
 * Job kinds the consumer can actually process. `notification.send` has a
 * producer (providers/notification.tsx) but no processXJob yet, so it is left
 * out on purpose: those rows stay PENDING instead of landing in the DLQ.
 */
export const SUPPORTED_KINDS = [
  'audio.generate',
  'prayer.publish',
  'payment.sync',
  'voice.register',
  'mail.send',
] as const

export type JobKind = (typeof SUPPORTED_KINDS)[number]

export type DispatchSummary = {
  scanned: number
  byKind: Record<string, number>
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
  let scanned = 0

  for (const kind of SUPPORTED_KINDS) {
    // Due scheduled prayers become prayer.publish jobs before they are claimed.
    if (kind === 'prayer.publish') {
      const scan = await scanDueScheduledPrayers()
      scanned = scan.enqueued
    }

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
