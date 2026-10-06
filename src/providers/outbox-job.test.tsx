// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { db } = vi.hoisted(() => ({
  db: {
    outboxJob: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/utils/db-connection', () => ({ db }))

import { CLAIM_PENDING_JOBS, GET_JOB, MARK_JOB_STATE } from './outbox-job'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('CLAIM_PENDING_JOBS', () => {
  it('claims PENDING and lease-expired RUNNING rows, skips lost update races', async () => {
    db.outboxJob.findMany.mockResolvedValue([
      { id: 'j1', state: 'PENDING', attempts: 0, resource_id: 'r1', payload: { a: 1 } },
      { id: 'j2', state: 'RUNNING', attempts: 2, resource_id: 'r2', payload: null },
    ])
    db.outboxJob.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })

    const now = new Date('2026-10-02T00:00:00Z')
    const claimed = await CLAIM_PENDING_JOBS({ kind: 'audio.generate', now })

    expect(db.outboxJob.findMany).toHaveBeenCalledWith({
      where: {
        kind: 'audio.generate',
        available_at: { lte: now },
        OR: [{ state: 'PENDING' }, { state: 'RUNNING', lease_until: { lt: now } }],
      },
      orderBy: { available_at: 'asc' },
      take: 5,
    })
    expect(db.outboxJob.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'j1', state: 'PENDING' },
      data: {
        state: 'RUNNING',
        attempts: { increment: 1 },
        lease_until: new Date(now.getTime() + 300_000),
      },
    })
    expect(claimed).toEqual([{ id: 'j1', attempts: 1, resource_id: 'r1', payload: { a: 1 } }])
  })

  it('honors limit and leaseSeconds overrides', async () => {
    db.outboxJob.findMany.mockResolvedValue([
      { id: 'j9', state: 'PENDING', attempts: 0, resource_id: 'r9', payload: null },
    ])
    db.outboxJob.updateMany.mockResolvedValue({ count: 1 })
    const now = new Date()
    await CLAIM_PENDING_JOBS({ kind: 'prayer.publish', limit: 2, leaseSeconds: 60, now })
    expect(db.outboxJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ kind: 'prayer.publish' }),
        take: 2,
      }),
    )
    expect(db.outboxJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lease_until: new Date(now.getTime() + 60_000) }),
      }),
    )
  })
})

describe('GET_JOB', () => {
  it('reads a single job row by id', async () => {
    db.outboxJob.findUnique.mockResolvedValue({ id: 'job1', state: 'RUNNING' })
    expect(await GET_JOB({ jobId: 'job1' })).toEqual({ id: 'job1', state: 'RUNNING' })
    expect(db.outboxJob.findUnique).toHaveBeenCalledWith({ where: { id: 'job1' } })
  })
})

describe('MARK_JOB_STATE', () => {
  it('success clears the lease and any stale error code from earlier attempts', async () => {
    await MARK_JOB_STATE({ jobId: 'j1', state: 'SUCCEEDED' })
    expect(db.outboxJob.update).toHaveBeenCalledWith({
      where: { id: 'j1' },
      data: { state: 'SUCCEEDED', lease_until: null, last_error_code: null },
    })
  })

  it('failure clears the lease and stamps the error code', async () => {
    await MARK_JOB_STATE({ jobId: 'j2', state: 'FAILED', errorCode: 'TTS_REQUEST_FAILED' })
    expect(db.outboxJob.update).toHaveBeenCalledWith({
      where: { id: 'j2' },
      data: {
        state: 'FAILED',
        lease_until: null,
        last_error_code: 'TTS_REQUEST_FAILED',
      },
    })
  })

  it('requeue keeps the error code and reschedules availability, keeps no lease', async () => {
    const at = new Date('2026-10-02T00:01:00Z')
    await MARK_JOB_STATE({
      jobId: 'j3',
      state: 'PENDING',
      errorCode: 'TTS_NETWORK',
      availableAt: at,
    })
    expect(db.outboxJob.update).toHaveBeenCalledWith({
      where: { id: 'j3' },
      data: {
        state: 'PENDING',
        lease_until: null,
        last_error_code: 'TTS_NETWORK',
        available_at: at,
      },
    })
  })

  it('requeue without availableAt only clears the lease', async () => {
    await MARK_JOB_STATE({ jobId: 'j4', state: 'PENDING' })
    expect(db.outboxJob.update).toHaveBeenCalledWith({
      where: { id: 'j4' },
      data: { state: 'PENDING', lease_until: null },
    })
  })
})
