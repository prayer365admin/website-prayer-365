import { runGeneralPrayerAudioTick } from '../src/controller/general-prayer-audio-job'
import { logger } from '../src/utils/logger'
import { db } from '../src/utils/db-connection'

/*
 * general_prayer.audio worker entry (local/dev). Thin loop: claim outbox rows of
 * kind general_prayer.audio, run the job controller, log the tick summary.
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
  const pollMs = Number(process.env.GENERAL_PRAYER_AUDIO_WORKER_POLL_MS ?? 5000)
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  do {
    try {
      const summary = await runGeneralPrayerAudioTick()
      logger.info('general_prayer_audio_tick', summary)
    } catch (err) {
      logger.error('general_prayer_audio_tick_failed', {
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
    logger.error('general_prayer_audio_worker_crashed', {
      error_code: 'WORKER_CRASHED',
      message: err instanceof Error ? err.message : String(err),
    })
    process.exitCode = 1
    logger.close()
    setTimeout(() => process.exit(1), 250).unref()
  })
