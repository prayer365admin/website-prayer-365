// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  processPrayerPublishJob,
  scanDueScheduledPrayers,
  runPrayerPublishTick,
} from './prayer-publish-job'

const mocks = vi.hoisted(() => {
  const fns = (names: string[]) => Object.fromEntries(names.map((n) => [n, vi.fn()]))
  return {
    outbox: fns(['CLAIM_PENDING_JOBS', 'GET_JOB', 'MARK_JOB_STATE']),
    prayer: fns([
      'GET_PRAYER_FOR_PUBLISH_JOB',
      'PUBLISH_PRAYER_BY_JOB',
      'GET_VERSION_APPROVAL',
      'SCAN_DUE_SCHEDULED_PRAYERS',
      'ENQUEUE_DUE_PRAYER_PUBLISH',
    ]),
    notification: fns(['ENQUEUE_NOTIFICATION']),
  }
})

vi.mock('@/providers/outbox-job', () => mocks.outbox)
vi.mock('@/providers/prayer', () => mocks.prayer)
vi.mock('@/providers/notification', () => mocks.notification)

const baseJob = {
  id: 'job1',
  kind: 'prayer.publish',
  dedupe_key: 'prayer.publish:pr1:v1',
  resource_id: 'pr1',
  payload: { prayerVersionId: 'v1', churchId: 'c1' } as unknown,
  available_at: new Date(),
  state: 'RUNNING' as const,
  attempts: 1,
  lease_until: new Date(),
  last_error_code: null,
  created_at: new Date(),
  updated_at: new Date(),
}

const basePrayer = {
  id: 'pr1',
  church_id: 'c1',
  version: 5,
  published_version_id: null as string | null,
  published_at: null as Date | null,
  scheduled_version_id: 'v1' as string | null,
  scheduled_at: new Date('2026-10-01') as Date | null,
  church: { id: 'c1', status: 'APPROVED' as const },
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.outbox.GET_JOB.mockResolvedValue(baseJob)
  mocks.prayer.GET_PRAYER_FOR_PUBLISH_JOB.mockResolvedValue(structuredClone(basePrayer))
  mocks.prayer.GET_VERSION_APPROVAL.mockResolvedValue({ id: 'v1', approved_at: new Date() })
  mocks.prayer.PUBLISH_PRAYER_BY_JOB.mockResolvedValue({ count: 1 })
  mocks.notification.ENQUEUE_NOTIFICATION.mockResolvedValue({ id: 'n1' })
  mocks.prayer.SCAN_DUE_SCHEDULED_PRAYERS.mockResolvedValue([])
  mocks.prayer.ENQUEUE_DUE_PRAYER_PUBLISH.mockResolvedValue({ id: 'oj1' })
  mocks.outbox.CLAIM_PENDING_JOBS.mockResolvedValue([])
  mocks.outbox.MARK_JOB_STATE.mockResolvedValue({})
})

const expectJobDone = (state: 'SUCCEEDED' | 'FAILED', errorCode?: string) =>
  expect(mocks.outbox.MARK_JOB_STATE).toHaveBeenCalledWith({
    jobId: 'job1',
    state,
    ...(errorCode ? { errorCode } : {}),
  })

const failCase = (name: string, mutate: () => void, errorCode: string) => {
  it(name, async () => {
    mutate()
    await expect(processPrayerPublishJob('job1', 'rq')).resolves.toBe('failed')
    expectJobDone('FAILED', errorCode)
    expect(mocks.prayer.PUBLISH_PRAYER_BY_JOB).not.toHaveBeenCalled()
  })
}

describe('processPrayerPublishJob — preconditions', () => {
  it('skips when the job row is missing or not RUNNING', async () => {
    mocks.outbox.GET_JOB.mockResolvedValueOnce(null)
    await expect(processPrayerPublishJob('job1', 'rq')).resolves.toBe('skipped')

    mocks.outbox.GET_JOB.mockResolvedValueOnce({ ...baseJob, state: 'PENDING' })
    await expect(processPrayerPublishJob('job1', 'rq')).resolves.toBe('skipped')

    mocks.outbox.GET_JOB.mockResolvedValueOnce({ ...baseJob, resource_id: null })
    await expect(processPrayerPublishJob('job1', 'rq')).resolves.toBe('skipped')

    expect(mocks.prayer.GET_PRAYER_FOR_PUBLISH_JOB).not.toHaveBeenCalled()
  })

  it('fails MISSING_PAYLOAD when payload is null', async () => {
    mocks.outbox.GET_JOB.mockResolvedValueOnce({ ...baseJob, payload: null })
    await expect(processPrayerPublishJob('job1', 'rq')).resolves.toBe('failed')
    expectJobDone('FAILED', 'MISSING_PAYLOAD')
  })

  it('marks SUCCEEDED when the prayer was deleted', async () => {
    mocks.prayer.GET_PRAYER_FOR_PUBLISH_JOB.mockResolvedValueOnce(null)
    await expect(processPrayerPublishJob('job1', 'rq')).resolves.toBe('succeeded')
    expectJobDone('SUCCEEDED')
    expect(mocks.prayer.PUBLISH_PRAYER_BY_JOB).not.toHaveBeenCalled()
  })

  it('marks SUCCEEDED without re-publishing for duplicate delivery', async () => {
    mocks.prayer.GET_PRAYER_FOR_PUBLISH_JOB.mockResolvedValueOnce({
      ...basePrayer,
      published_version_id: 'v1',
    })
    await expect(processPrayerPublishJob('job1', 'rq')).resolves.toBe('succeeded')
    expectJobDone('SUCCEEDED')
    expect(mocks.prayer.PUBLISH_PRAYER_BY_JOB).not.toHaveBeenCalled()
    expect(mocks.notification.ENQUEUE_NOTIFICATION).not.toHaveBeenCalled()
  })
})

describe('processPrayerPublishJob — guard ladder', () => {
  failCase(
    'fails CHURCH_NOT_APPROVED when church is suspended',
    () => {
      mocks.prayer.GET_PRAYER_FOR_PUBLISH_JOB.mockResolvedValueOnce({
        ...basePrayer,
        church: { id: 'c1', status: 'SUSPENDED' },
      })
    },
    'CHURCH_NOT_APPROVED',
  )

  failCase(
    'fails SUPERSEDED_SCHEDULE when a newer version was scheduled',
    () => {
      mocks.prayer.GET_PRAYER_FOR_PUBLISH_JOB.mockResolvedValueOnce({
        ...basePrayer,
        scheduled_version_id: 'v2',
      })
    },
    'SUPERSEDED_SCHEDULE',
  )

  failCase(
    'fails VERSION_NOT_APPROVED when version has no approval',
    () => {
      mocks.prayer.GET_VERSION_APPROVAL.mockResolvedValueOnce({ id: 'v1', approved_at: null })
    },
    'VERSION_NOT_APPROVED',
  )

  failCase(
    'fails VERSION_NOT_APPROVED when version not found',
    () => {
      mocks.prayer.GET_VERSION_APPROVAL.mockResolvedValueOnce(null)
    },
    'VERSION_NOT_APPROVED',
  )

  it('does NOT fail SUPERSEDED_SCHEDULE for immediate publish', async () => {
    mocks.prayer.GET_PRAYER_FOR_PUBLISH_JOB.mockResolvedValueOnce({
      ...basePrayer,
      scheduled_version_id: null,
      scheduled_at: null,
    })
    await expect(processPrayerPublishJob('job1', 'rq')).resolves.toBe('succeeded')
  })
})

describe('processPrayerPublishJob — publish happy path', () => {
  it('publishes, enqueues notification, marks SUCCEEDED', async () => {
    await expect(processPrayerPublishJob('job1', 'rq')).resolves.toBe('succeeded')

    expect(mocks.prayer.PUBLISH_PRAYER_BY_JOB).toHaveBeenCalledWith({
      prayerId: 'pr1',
      prayerVersionId: 'v1',
      churchId: 'c1',
      expectedVersion: 5,
      requestId: 'rq',
    })

    expect(mocks.notification.ENQUEUE_NOTIFICATION).toHaveBeenCalledWith({
      type: 'prayer_published',
      resourceId: 'pr1',
      churchId: 'c1',
      dedupeKeySuffix: 'pr1:v1',
    })

    expectJobDone('SUCCEEDED')
  })
})

describe('processPrayerPublishJob — publish race', () => {
  it('requeues when publish loses version race', async () => {
    mocks.prayer.PUBLISH_PRAYER_BY_JOB.mockResolvedValueOnce({ count: 0 })
    await expect(processPrayerPublishJob('job1', 'rq')).resolves.toBe('requeued')

    expect(mocks.outbox.MARK_JOB_STATE).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job1',
        state: 'PENDING',
        errorCode: 'CONCURRENCY_CONFLICT',
      }),
    )
    const call = mocks.outbox.MARK_JOB_STATE.mock.calls[0][0]
    expect(call.availableAt.getTime()).toBeGreaterThan(Date.now())
    expect(mocks.notification.ENQUEUE_NOTIFICATION).not.toHaveBeenCalled()
  })
})

describe('processPrayerPublishJob — notification failure tolerance', () => {
  it('succeeds even when notification enqueue throws unique violation', async () => {
    mocks.notification.ENQUEUE_NOTIFICATION.mockRejectedValueOnce(
      Object.assign(new Error('unique'), { code: 'P2002' }),
    )
    await expect(processPrayerPublishJob('job1', 'rq')).resolves.toBe('succeeded')
    expectJobDone('SUCCEEDED')
  })

  it('succeeds even when notification enqueue throws unknown error', async () => {
    mocks.notification.ENQUEUE_NOTIFICATION.mockRejectedValueOnce(new Error('db down'))
    await expect(processPrayerPublishJob('job1', 'rq')).resolves.toBe('succeeded')
    expectJobDone('SUCCEEDED')
  })
})

describe('processPrayerPublishJob — retry decisions', () => {
  it('requeues with backoff on unexpected error before MAX_ATTEMPTS', async () => {
    mocks.prayer.PUBLISH_PRAYER_BY_JOB.mockRejectedValueOnce(new Error('db'))
    await expect(processPrayerPublishJob('job1', 'rq')).resolves.toBe('requeued')

    expect(mocks.outbox.MARK_JOB_STATE).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job1',
        state: 'PENDING',
        errorCode: 'INTERNAL_JOB_ERROR',
      }),
    )
    const call = mocks.outbox.MARK_JOB_STATE.mock.calls[0][0]
    // 1 attempt backoff: 30000 * 2^1 = 60000
    expect(call.availableAt.getTime()).toBeGreaterThan(Date.now() + 59000)
  })

  it('fails permanently after MAX_ATTEMPTS', async () => {
    mocks.outbox.GET_JOB.mockResolvedValueOnce({ ...baseJob, attempts: 3 })
    mocks.prayer.PUBLISH_PRAYER_BY_JOB.mockRejectedValueOnce(new Error('db'))
    await expect(processPrayerPublishJob('job1', 'rq')).resolves.toBe('failed')
    expectJobDone('FAILED', 'INTERNAL_JOB_ERROR')
  })

  it('treats non-finite env max attempts as default 3', async () => {
    process.env.PRAYER_PUBLISH_MAX_ATTEMPTS = 'banana'
    vi.resetModules()
    const { processPrayerPublishJob: freshProcess } = await import('./prayer-publish-job')

    mocks.outbox.GET_JOB.mockResolvedValueOnce({ ...baseJob, attempts: 3 })
    mocks.prayer.PUBLISH_PRAYER_BY_JOB.mockRejectedValueOnce(new Error('db'))
    await expect(freshProcess('job1', 'rq')).resolves.toBe('failed')
    expectJobDone('FAILED', 'INTERNAL_JOB_ERROR')

    delete process.env.PRAYER_PUBLISH_MAX_ATTEMPTS
  })
})

describe('scanDueScheduledPrayers', () => {
  it('enqueues outbox rows for each due prayer', async () => {
    mocks.prayer.SCAN_DUE_SCHEDULED_PRAYERS.mockResolvedValueOnce([
      {
        id: 'pr1',
        scheduled_version_id: 'v1',
        church_id: 'c1',
        scheduled_at: new Date('2026-10-01'),
      },
      {
        id: 'pr2',
        scheduled_version_id: 'v2',
        church_id: 'c2',
        scheduled_at: new Date('2026-10-02'),
      },
    ])

    await expect(scanDueScheduledPrayers()).resolves.toEqual({ enqueued: 2 })

    expect(mocks.prayer.ENQUEUE_DUE_PRAYER_PUBLISH).toHaveBeenCalledTimes(2)
    expect(mocks.prayer.ENQUEUE_DUE_PRAYER_PUBLISH).toHaveBeenNthCalledWith(1, {
      prayerId: 'pr1',
      prayerVersionId: 'v1',
      churchId: 'c1',
      availableAt: new Date('2026-10-01'),
    })
    expect(mocks.prayer.ENQUEUE_DUE_PRAYER_PUBLISH).toHaveBeenNthCalledWith(2, {
      prayerId: 'pr2',
      prayerVersionId: 'v2',
      churchId: 'c2',
      availableAt: new Date('2026-10-02'),
    })
  })

  it('picks up prayers that fell due during extended downtime', async () => {
    mocks.prayer.SCAN_DUE_SCHEDULED_PRAYERS.mockResolvedValueOnce([
      {
        id: 'pr-late',
        scheduled_version_id: 'v1',
        church_id: 'c1',
        scheduled_at: new Date('2026-09-01T00:00:00Z'),
      },
    ])

    await expect(scanDueScheduledPrayers()).resolves.toEqual({ enqueued: 1 })

    expect(mocks.prayer.ENQUEUE_DUE_PRAYER_PUBLISH).toHaveBeenCalledTimes(1)
    expect(mocks.prayer.ENQUEUE_DUE_PRAYER_PUBLISH).toHaveBeenCalledWith({
      prayerId: 'pr-late',
      prayerVersionId: 'v1',
      churchId: 'c1',
      availableAt: new Date('2026-09-01T00:00:00Z'),
    })
  })

  it('individual enqueue failure does not block others', async () => {
    mocks.prayer.SCAN_DUE_SCHEDULED_PRAYERS.mockResolvedValueOnce([
      {
        id: 'pr1',
        scheduled_version_id: 'v1',
        church_id: 'c1',
        scheduled_at: new Date('2026-10-01'),
      },
      {
        id: 'pr2',
        scheduled_version_id: 'v2',
        church_id: 'c2',
        scheduled_at: new Date('2026-10-02'),
      },
    ])
    mocks.prayer.ENQUEUE_DUE_PRAYER_PUBLISH.mockRejectedValueOnce(new Error('db'))

    await expect(scanDueScheduledPrayers()).resolves.toEqual({ enqueued: 1 })
    expect(mocks.prayer.ENQUEUE_DUE_PRAYER_PUBLISH).toHaveBeenCalledTimes(2)
  })
})

describe('runPrayerPublishTick', () => {
  it('scans due prayers then claims and processes jobs', async () => {
    mocks.outbox.CLAIM_PENDING_JOBS.mockResolvedValueOnce([{ id: 'job1' }])

    await expect(runPrayerPublishTick()).resolves.toEqual({
      scanned: 0,
      claimed: 1,
      succeeded: 1,
      failed: 0,
      requeued: 0,
      skipped: 0,
    })

    expect(mocks.prayer.SCAN_DUE_SCHEDULED_PRAYERS).toHaveBeenCalled()
    expect(mocks.outbox.CLAIM_PENDING_JOBS).toHaveBeenCalledWith({
      kind: 'prayer.publish',
      limit: 5,
    })
  })

  it('aggregates outcomes across claimed jobs', async () => {
    mocks.outbox.CLAIM_PENDING_JOBS.mockResolvedValueOnce([
      { id: 'job1' },
      { id: 'job2' },
      { id: 'job3' },
    ])

    mocks.outbox.GET_JOB.mockResolvedValueOnce({ ...baseJob, id: 'job1' })
    // second fails
    mocks.outbox.GET_JOB.mockResolvedValueOnce({ ...baseJob, id: 'job2', payload: null })
    // third requeues
    mocks.outbox.GET_JOB.mockResolvedValueOnce({ ...baseJob, id: 'job3', attempts: 1 })
    mocks.prayer.PUBLISH_PRAYER_BY_JOB.mockRejectedValueOnce(new Error('db'))

    await expect(runPrayerPublishTick()).resolves.toEqual({
      scanned: 0,
      claimed: 3,
      succeeded: 1,
      failed: 1,
      requeued: 1,
      skipped: 0,
    })
  })

  it('isolates one crashing job and keeps processing the rest', async () => {
    mocks.outbox.CLAIM_PENDING_JOBS.mockResolvedValueOnce([{ id: 'job1' }, { id: 'job2' }])

    mocks.outbox.GET_JOB.mockRejectedValueOnce(new Error('db')) // completely unexpected crash
    mocks.outbox.GET_JOB.mockResolvedValueOnce({ ...baseJob, id: 'job2' })

    await expect(runPrayerPublishTick()).resolves.toEqual({
      scanned: 0,
      claimed: 2,
      succeeded: 1,
      failed: 0,
      requeued: 0,
      skipped: 1, // the first one threw
    })

    expect(mocks.outbox.MARK_JOB_STATE).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job1',
        state: 'PENDING',
        errorCode: 'INTERNAL_JOB_ERROR',
      }),
    )
  })
})
