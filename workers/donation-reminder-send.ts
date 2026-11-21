import { runDonationReminderSendTick } from '../src/controller/donation-reminder-send-job'
import { logger } from '../src/utils/logger'
import { db } from '../src/utils/db-connection'

/*
 * donation_reminder.send worker entry (local/dev). Thin loop: claim outbox rows of
 * kind donation_reminder.send, run the job controller, log the tick summary.
 * In production the SQS consumer Lambda calls the same processor.
 *
 * Run with `--once` for a single tick (CI/smoke), default is a poll loop.
 * Prisma client must be generated first: `bun prisma generate`.
 */

const stopping = { value: false }

const stop = () => {
  stopping.value = true
}

const sleep = (ms: number) => {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, ms)
  return promise
}

const main = async () => {
  const once = process.argv.includes('--once')
  const pollMs = Number(process.env.DONATION_REMINDER_SEND_WORKER_POLL_MS ?? 5000)
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  do {
    try {
      const summary = await runDonationReminderSendTick()
      logger.info('donation_reminder_send_tick', summary)
    } catch (err) {
      logger.error('donation_reminder_send_tick_failed', {
        error_code: 'TICK_FAILED',
        message: err instanceof Error ? err.message : String(err),
      })
    }
    if (!once && !stopping.value) await sleep(pollMs)
  } while (!once && !stopping.value)
}

main()
  .then(async () => {
    logger.close()
    await db.$disconnect().catch(() => undefined)
    setTimeout(() => process.exit(0), 250).unref()
  })
  .catch((err) => {
    logger.error('donation_reminder_send_worker_crashed', {
      error_code: 'WORKER_CRASHED',
      message: err instanceof Error ? err.message : String(err),
    })
    process.exitCode = 1
    logger.close()
    setTimeout(() => process.exit(1), 250).unref()
  })
