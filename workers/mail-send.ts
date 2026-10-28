import { runMailSendTick } from '../src/controller/mail-send-job'
import { logger } from '../src/utils/logger'
import { db } from '../src/utils/db-connection'

/*
 * mail.send worker entry. Thin loop: claim outbox rows of kind
 * mail.send, run the job controller, log the tick summary.
 * Recoverable by design — CLAIM_PENDING_JOBS re-claims lease-expired RUNNING
 * rows, so a crashed tick's jobs come back on the next poll.
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
  const pollMs = Number(process.env.MAIL_SEND_WORKER_POLL_MS ?? 5000)
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  do {
    try {
      const summary = await runMailSendTick()
      logger.info('mail_send_tick', summary)
    } catch (err) {
      logger.error('mail_send_tick_failed', {
        error_code: 'TICK_FAILED',
        message: err instanceof Error ? err.message : String(err),
      })
    }
    if (!once && !stopping.value) await sleep(pollMs)
  } while (!once && !stopping.value)
}

main()
  .then(async () => {
    // Winston's console transport writes asynchronously, so exiting straight
    // away truncates the tick log line. Close the logger + DB and let the event
    // loop end naturally; the short unref'd fallback only fires if a pooled
    // socket keeps the process alive, by which time stdout has drained.
    logger.close()
    await db.$disconnect().catch(() => undefined)
    setTimeout(() => process.exit(0), 250).unref()
  })
  .catch((err) => {
    logger.error('mail_send_worker_crashed', {
      error_code: 'WORKER_CRASHED',
      message: err instanceof Error ? err.message : String(err),
    })
    process.exitCode = 1
    logger.close()
    setTimeout(() => process.exit(1), 250).unref()
  })
