// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SQSEvent, SQSRecord } from 'aws-lambda'

/*
 * Consumer/dispatcher Lambda contract tests. The job controllers are mocked: the
 * suite asserts transport behaviour (partial batch failures, duplicate handling,
 * no process.exit), not the jobs themselves.
 */

const mocks = vi.hoisted(() => {
  const fns = (names: string[]) => Object.fromEntries(names.map((n) => [n, vi.fn()]))
  return {
    audio: fns(['processAudioGenerateJob']),
    publish: fns(['processPrayerPublishJob']),
    payment: fns(['processPaymentSyncJob']),
    voice: fns(['processVoiceRegisterJob']),
    mail: fns(['processMailSendJob']),
    notification: fns(['processNotificationSendJob']),
    dispatch: fns(['runDispatcher']),
    logger: fns(['info', 'error']),
  }
})

vi.mock('@/controller/audio-generate-job', () => mocks.audio)
vi.mock('@/controller/prayer-publish-job', () => mocks.publish)
vi.mock('@/controller/payment-sync-job', () => mocks.payment)
vi.mock('@/controller/voice-register-job', () => mocks.voice)
vi.mock('@/controller/mail-send-job', () => mocks.mail)
vi.mock('@/controller/notification-send-job', () => mocks.notification)
vi.mock('@/controller/job-dispatch', () => ({
  runDispatcher: mocks.dispatch.runDispatcher,
  SUPPORTED_KINDS: [
    'audio.generate',
    'mail.send',
    'notification.send',
    'payment.sync',
    'prayer.publish',
    'voice.register',
  ],
}))
vi.mock('@/utils/logger', () => ({ logger: mocks.logger }))

import { handler as consumerHandler, HANDLERS } from './consumer'
import { handler as dispatcherHandler } from './dispatcher'

const record = (messageId: string, body: unknown): SQSRecord =>
  ({
    messageId,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as SQSRecord

const sqsEvent = (...records: SQSRecord[]): SQSEvent => ({ Records: records })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.audio.processAudioGenerateJob.mockResolvedValue('succeeded')
  mocks.publish.processPrayerPublishJob.mockResolvedValue('succeeded')
  mocks.payment.processPaymentSyncJob.mockResolvedValue('succeeded')
  mocks.voice.processVoiceRegisterJob.mockResolvedValue('succeeded')
  mocks.mail.processMailSendJob.mockResolvedValue('succeeded')
})

describe('consumer handler', () => {
  it('runs each message through its kind processor and reports no failures', async () => {
    const result = await consumerHandler(
      sqsEvent(
        record('m1', { kind: 'audio.generate', jobId: 'job-1' }),
        record('m2', { kind: 'payment.sync', jobId: 'job-2' }),
      ),
    )

    expect(mocks.audio.processAudioGenerateJob).toHaveBeenCalledWith('job-1', expect.any(String))
    expect(mocks.payment.processPaymentSyncJob).toHaveBeenCalledWith('job-2', expect.any(String))
    expect(result).toEqual({ batchItemFailures: [] })
    expect(mocks.logger.info).toHaveBeenCalledWith('job_processed', {
      job_kind: 'audio.generate',
      job_id: 'job-1',
      outcome: 'succeeded',
    })
  })

  it('treats a duplicate delivery (skipped) as success, not a failure', async () => {
    mocks.audio.processAudioGenerateJob.mockResolvedValue('skipped')

    const result = await consumerHandler(
      sqsEvent(record('m1', { kind: 'audio.generate', jobId: 'job-1' })),
    )

    expect(result.batchItemFailures).toEqual([])
  })

  it('reports only the failing message in a batch', async () => {
    mocks.audio.processAudioGenerateJob.mockRejectedValue(new Error('db down'))

    const result = await consumerHandler(
      sqsEvent(
        record('m1', { kind: 'audio.generate', jobId: 'job-1' }),
        record('m2', { kind: 'voice.register', jobId: 'job-2' }),
      ),
    )

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'm1' }])
    expect(mocks.voice.processVoiceRegisterJob).toHaveBeenCalledTimes(1)
    expect(mocks.logger.error).toHaveBeenCalledWith('job_processing_failed', {
      job_kind: 'audio.generate',
      job_id: 'job-1',
      error_code: 'CONSUMER_ERROR',
    })
  })

  it('fails an unknown kind instead of dropping it silently', async () => {
    const result = await consumerHandler(
      sqsEvent(record('m1', { kind: 'notifications.unknown', jobId: 'job-9' })),
    )

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'm1' }])
    expect(mocks.logger.error).toHaveBeenCalledWith('job_message_invalid', {
      job_kind: 'notifications.unknown',
      message_id: 'm1',
    })
  })

  it('fails an unparseable body', async () => {
    const result = await consumerHandler(sqsEvent(record('m1', 'not-json')))

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'm1' }])
  })

  it('never calls process.exit', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)

    await consumerHandler(sqsEvent(record('m1', { kind: 'audio.generate', jobId: 'job-1' })))
    await dispatcherHandler()

    expect(exitSpy).not.toHaveBeenCalled()
    exitSpy.mockRestore()
  })
})

describe('dispatcher handler', () => {
  it('delegates to the controller and returns its summary', async () => {
    const summary = { scanned: 0, byKind: { 'audio.generate': 1 } }
    mocks.dispatch.runDispatcher.mockResolvedValue(summary)

    await expect(dispatcherHandler()).resolves.toEqual(summary)
    expect(mocks.dispatch.runDispatcher).toHaveBeenCalledTimes(1)
  })

  it('exposes a processor for every supported kind', () => {
    expect(Object.keys(HANDLERS).sort()).toEqual([
      'audio.generate',
      'mail.send',
      'notification.send',
      'payment.sync',
      'prayer.publish',
      'voice.register',
    ])
  })
})
