import { runPrayerPublishTick } from '../src/controller/prayer-publish-job'
import { logger } from '../src/utils/logger'
import '../src/utils/db-connection'

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
  const pollMs = Number(process.env.PRAYER_PUBLISH_WORKER_POLL_MS ?? 5000)
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  do {
    try {
      const summary = await runPrayerPublishTick()
      logger.info('prayer_publish_tick', summary)
    } catch (err) {
      logger.error('prayer_publish_tick_failed', {
        error_code: 'TICK_FAILED',
        message: err instanceof Error ? err.message : String(err),
      })
    }
    if (!once && !stopping.value) await sleep(pollMs)
  } while (!once && !stopping.value)
}

main()
  .then(() => {
    logger.on('finish', () => process.exit(0))
    logger.close()
  })
  .catch((err) => {
    logger.error('prayer_publish_worker_crashed', {
      error_code: 'WORKER_CRASHED',
      message: err instanceof Error ? err.message : String(err),
    })
    process.exit(1)
  })
