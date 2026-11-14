// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Dispatcher unit tests: every seam is mocked, so the suite asserts the contract
 * (which kinds are claimed, what is sent, lease propagation) and not Prisma/SQS.
 */

const mocks = vi.hoisted(() => {
  const fns = (names: string[]) => Object.fromEntries(names.map((n) => [n, vi.fn()]))
  return {
    outbox: fns(['CLAIM_PENDING_JOBS']),
    sqs: fns(['SQS_SEND_JOB']),
    publish: fns(['scanDueScheduledPrayers']),
    schedule: fns(['scanDueEventReminders', 'scanDueDonationReminders']),
    generalPrayer: fns(['scanDueGeneralPrayer']),
    logger: fns(['info', 'error']),
  }
})

vi.mock('@/providers/outbox-job', () => mocks.outbox)
vi.mock('@/providers/sqs', () => mocks.sqs)
vi.mock('@/controller/prayer-publish-job', () => mocks.publish)
vi.mock('@/controller/notification-schedule', () => mocks.schedule)
vi.mock('@/controller/general-prayer-schedule', () => mocks.generalPrayer)
vi.mock('@/utils/logger', () => ({ logger: mocks.logger }))

import { runCalendarSweeps, runDispatcher, SUPPORTED_KINDS } from './job-dispatch'

const ENV_KEYS = ['JOBS_QUEUE_URL', 'JOB_CLAIM_LIMIT', 'JOB_LEASE_SECONDS'] as const
const envSnapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.JOBS_QUEUE_URL = 'https://sqs/jobs'
  delete process.env.JOB_CLAIM_LIMIT
  delete process.env.JOB_LEASE_SECONDS
  mocks.publish.scanDueScheduledPrayers.mockResolvedValue({ enqueued: 0 })
  mocks.schedule.scanDueEventReminders.mockResolvedValue({ enqueued: 0 })
  mocks.schedule.scanDueDonationReminders.mockResolvedValue({ enqueued: 0 })
  mocks.generalPrayer.scanDueGeneralPrayer.mockResolvedValue({ enqueued: 0 })
  mocks.outbox.CLAIM_PENDING_JOBS.mockResolvedValue([])
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (envSnapshot[key] === undefined) delete process.env[key]
    else process.env[key] = envSnapshot[key]
  }
})

describe('runCalendarSweeps', () => {
  it('sums every producer and reports them by name', async () => {
    mocks.publish.scanDueScheduledPrayers.mockResolvedValue({ enqueued: 2 })
    mocks.schedule.scanDueEventReminders.mockResolvedValue({ enqueued: 1 })
    mocks.schedule.scanDueDonationReminders.mockResolvedValue({ enqueued: 4 })
    mocks.generalPrayer.scanDueGeneralPrayer.mockResolvedValue({ enqueued: 1 })

    const summary = await runCalendarSweeps()

    expect(summary.enqueued).toBe(8)
    expect(summary.bySweep).toEqual({
      'prayer.publish': 2,
      event_reminder: 1,
      donation_reminder: 4,
      general_prayer: 1,
    })
  })

  it('needs no SQS queue to produce the rows (the local scheduler contract)', async () => {
    const saved = process.env.JOBS_QUEUE_URL
    delete process.env.JOBS_QUEUE_URL
    try {
      await expect(runCalendarSweeps()).resolves.toBeTruthy()
    } finally {
      if (saved !== undefined) process.env.JOBS_QUEUE_URL = saved
    }
  })
})

describe('runDispatcher', () => {
  it('claims and forwards one message per job, with the default limit and lease', async () => {
    mocks.outbox.CLAIM_PENDING_JOBS.mockImplementation(({ kind }: { kind: string }) =>
      Promise.resolve(kind === 'audio.generate' ? [{ id: 'job-1' }, { id: 'job-2' }] : []),
    )

    const summary = await runDispatcher()

    expect(mocks.sqs.SQS_SEND_JOB).toHaveBeenCalledTimes(2)
    expect(mocks.sqs.SQS_SEND_JOB).toHaveBeenCalledWith({
      queueUrl: 'https://sqs/jobs',
      kind: 'audio.generate',
      jobId: 'job-1',
    })
    expect(mocks.outbox.CLAIM_PENDING_JOBS).toHaveBeenCalledWith({
      kind: 'audio.generate',
      limit: 10,
      leaseSeconds: 900,
    })
    expect(summary.byKind['audio.generate']).toBe(2)
    expect(mocks.logger.info).toHaveBeenCalledWith('job_dispatch_tick', summary)
  })

  it('runs every calendar producer exactly once per tick', async () => {
    mocks.publish.scanDueScheduledPrayers.mockResolvedValue({ enqueued: 3 })

    const summary = await runDispatcher()

    expect(mocks.publish.scanDueScheduledPrayers).toHaveBeenCalledTimes(1)
    expect(mocks.schedule.scanDueEventReminders).toHaveBeenCalledTimes(1)
    expect(mocks.schedule.scanDueDonationReminders).toHaveBeenCalledTimes(1)
    expect(mocks.generalPrayer.scanDueGeneralPrayer).toHaveBeenCalledTimes(1)
    expect(summary.scanned).toBe(3)
  })

  it('dispatches notification.send now that the worker exists', async () => {
    await runDispatcher()

    const claimedKinds = mocks.outbox.CLAIM_PENDING_JOBS.mock.calls.map(
      (call) => (call[0] as { kind: string }).kind,
    )
    expect(claimedKinds).toEqual([...SUPPORTED_KINDS])
    expect(claimedKinds).toContain('notification.send')
  })

  it('honours JOB_CLAIM_LIMIT and JOB_LEASE_SECONDS overrides', async () => {
    process.env.JOB_CLAIM_LIMIT = '3'
    process.env.JOB_LEASE_SECONDS = '120'

    await runDispatcher()

    expect(mocks.outbox.CLAIM_PENDING_JOBS).toHaveBeenCalledWith({
      kind: 'audio.generate',
      limit: 3,
      leaseSeconds: 120,
    })
  })

  it('throws when the queue URL is not configured', async () => {
    delete process.env.JOBS_QUEUE_URL

    await expect(runDispatcher()).rejects.toThrowError(/JOBS_QUEUE_URL is not set/)
    expect(mocks.outbox.CLAIM_PENDING_JOBS).not.toHaveBeenCalled()
  })
})
