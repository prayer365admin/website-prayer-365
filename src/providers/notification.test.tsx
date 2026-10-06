// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { db } = vi.hoisted(() => ({
  db: {
    outboxJob: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/utils/db-connection', () => ({ db }))

import { ENQUEUE_NOTIFICATION } from './notification'

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ now: new Date('2026-10-02T10:00:00.000Z') })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ENQUEUE_NOTIFICATION', () => {
  it('creates an outbox row for the notification', async () => {
    db.outboxJob.create.mockResolvedValueOnce({ id: 'oj1' })

    await ENQUEUE_NOTIFICATION({
      type: 'prayer_published',
      resourceId: 'pr1',
      churchId: 'c1',
      dedupeKeySuffix: 'pr1:v1',
    })

    expect(db.outboxJob.create).toHaveBeenCalledWith({
      data: {
        kind: 'notification.send',
        dedupe_key: 'notification.send:prayer_published:pr1:v1',
        resource_id: 'pr1',
        payload: { type: 'prayer_published', churchId: 'c1' },
        available_at: new Date('2026-10-02T10:00:00.000Z'),
      },
    })
  })
})
