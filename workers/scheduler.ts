import { runCalendarSweeps } from '../src/controller/job-dispatch'
import { logger } from '../src/utils/logger'
import { db } from '../src/utils/db-connection'

/*
 * Calendar-sweep worker entry (local dev). The production dispatcher Lambda runs
 * the same sweeps inside `runDispatcher`, then forwards the rows it created to
 * SQS; locally there is no SQS and no dispatcher process, so this loop is the
 * piece that makes a dated job (the 07:00 daily prayer, event reminders, the
 * donation nudge, due prayer publishes) actually appear in `outbox_jobs`.
 *
 * It only PRODUCES rows — pair it with the per-kind workers to process them:
 *   bun run worker:scheduler &
 *   bun run worker:general-prayer-send &
 *   bun run worker:mail-send
 *
 * Run with `--once` for a single sweep (CI/smoke), default is a poll loop.
 * The poll interval defaults to 60s to match the EventBridge rule; a sweep is
 * idempotent (unique dedupe keys), so a faster interval is harmless.
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
  const pollMs = Number(process.env.SCHEDULER_POLL_MS ?? 60000)
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  do {
    try {
      const summary = await runCalendarSweeps()
      logger.info('calendar_sweep_tick', summary)
    } catch (err) {
      logger.error('calendar_sweep_tick_failed', {
        error_code: 'TICK_FAILED',
        message: err instanceof Error ? err.message : String(err),
      })
    }
    if (!once && !stopping.value) await sleep(pollMs)
  } while (!once && !stopping.value)
}

main()
  .then(async () => {
    // Winston writes asynchronously; close the logger and let stdout drain
    // before the short unref'd fallback fires.
    logger.close()
    await db.$disconnect().catch(() => undefined)
    setTimeout(() => process.exit(0), 250).unref()
  })
  .catch((err) => {
    logger.error('calendar_sweep_worker_crashed', {
      error_code: 'WORKER_CRASHED',
      message: err instanceof Error ? err.message : String(err),
    })
    process.exitCode = 1
    logger.close()
    setTimeout(() => process.exit(1), 250).unref()
  })
