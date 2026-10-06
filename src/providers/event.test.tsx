// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { db, tx } = vi.hoisted(() => {
  const txObj = {
    event: { updateMany: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    outboxJob: { create: vi.fn(), createMany: vi.fn(), upsert: vi.fn() },
    notificationDelivery: { create: vi.fn(), createMany: vi.fn() },
  }
  return {
    tx: txObj,
    db: {
      $transaction: vi.fn(async (arg: unknown) =>
        Array.isArray(arg)
          ? Promise.all(arg as Promise<unknown>[])
          : (arg as (client: typeof txObj) => unknown)(txObj),
      ),
      event: {
        count: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      auditLog: { create: vi.fn() },
      outboxJob: txObj.outboxJob,
      notificationDelivery: txObj.notificationDelivery,
    },
  }
})

vi.mock('@/utils/db-connection', () => ({ db }))

import { CREATE_EVENT, GET_EVENT, LIST_EVENTS, UPDATE_EVENT } from './event'

const INPUT = {
  category: 'SERVICE' as const,
  title: 'Sunday Service',
  description: 'Weekly service',
  startsAt: '2026-10-04T08:00:00Z',
  location: 'Main Hall',
  registrationUrl: 'https://example.com/register',
  languageCode: 'en',
}

const eventRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'event-1',
  church_id: 'church-1',
  category: 'SERVICE',
  title: 'Sunday Service',
  description: 'Weekly service',
  starts_at: new Date('2026-10-04T08:00:00Z'),
  location: 'Main Hall',
  registration_url: 'https://example.com/register',
  language_code: 'en',
  version: 1,
  created_at: new Date('2026-09-01T00:00:00Z'),
  ...overrides,
})

describe('Event Provider', () => {
  beforeEach(() => vi.resetAllMocks())

  it('lists only events within the supplied church scope', async () => {
    db.event.count.mockResolvedValueOnce(1)
    db.event.findMany.mockResolvedValueOnce([eventRow()])

    const result = await LIST_EVENTS({
      churchIds: new Set(['church-1']),
      query: {
        page: 1,
        limit: 25,
        order_by: 'starts_at',
        order_direction: 'asc',
      },
    })

    expect(db.event.count).toHaveBeenCalledWith({ where: { church_id: { in: ['church-1'] } } })
    expect(db.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { church_id: { in: ['church-1'] } } }),
    )
    expect(result).toMatchObject({ total: 1, result: [{ churchId: 'church-1' }] })
  })

  it('searches title or location and applies link and start-range filters', async () => {
    db.event.count.mockResolvedValueOnce(0)
    db.event.findMany.mockResolvedValueOnce([])

    await LIST_EVENTS({
      churchIds: new Set(['church-1']),
      query: {
        page: 1,
        limit: 25,
        order_by: 'starts_at',
        order_direction: 'asc',
        search: 'hall',
        has_link: 'no',
        starts_from: '2026-02-01T00:00:00Z',
        starts_to: '2026-02-28T00:00:00Z',
      },
    })

    expect(db.event.count).toHaveBeenCalledWith({
      where: {
        church_id: { in: ['church-1'] },
        OR: [
          { title: { contains: 'hall', mode: 'insensitive' } },
          { location: { contains: 'hall', mode: 'insensitive' } },
        ],
        registration_url: null,
        starts_at: { gte: new Date('2026-02-01T00:00:00Z'), lte: new Date('2026-02-28T00:00:00Z') },
      },
    })
  })

  it('creates and audits against the exact requested church', async () => {
    db.event.create.mockResolvedValueOnce(eventRow())
    db.auditLog.create.mockResolvedValueOnce({})

    await CREATE_EVENT({
      churchId: 'church-1',
      data: INPUT,
      actorId: 'user-1',
      requestId: 'request-1',
    })

    expect(db.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ church_id: 'church-1' }),
    })
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        church_id: 'church-1',
        action: 'event.create',
        resource_id: 'event-1',
      }),
    })
  })

  it('reads only the exact requested church, independent of Set order', async () => {
    db.event.findFirst.mockResolvedValueOnce(null)

    await GET_EVENT({
      churchId: 'church-1',
      churchIds: new Set(['church-9', 'church-1']),
      eventId: 'event-1',
    })

    expect(db.event.findFirst).toHaveBeenCalledWith({
      where: { id: 'event-1', church_id: 'church-1' },
    })
  })

  it('does not query an event when the requested church is outside scope', async () => {
    await expect(
      GET_EVENT({
        churchId: 'church-9',
        churchIds: new Set(['church-1']),
        eventId: 'event-1',
      }),
    ).resolves.toBeNull()

    expect(db.event.findFirst).not.toHaveBeenCalled()
  })

  it('updates the exact church and increments its version once', async () => {
    tx.event.updateMany.mockResolvedValueOnce({ count: 1 })
    tx.event.findFirst.mockResolvedValueOnce(eventRow({ version: 2 }))
    tx.auditLog.create.mockResolvedValueOnce({})

    const result = await UPDATE_EVENT({
      churchId: 'church-1',
      churchIds: new Set(['church-9', 'church-1']),
      eventId: 'event-1',
      expectedVersion: 1,
      data: INPUT,
      actorId: 'user-1',
      requestId: 'request-1',
    })

    expect(tx.event.updateMany).toHaveBeenCalledWith({
      where: { id: 'event-1', church_id: 'church-1', version: 1 },
      data: expect.objectContaining({ version: { increment: 1 } }),
    })
    expect(tx.event.findFirst).toHaveBeenCalledWith({
      where: { id: 'event-1', church_id: 'church-1' },
    })
    expect(db.event.findFirst).not.toHaveBeenCalled()
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        church_id: 'church-1',
        action: 'event.update',
        resource_id: 'event-1',
      }),
    })
    expect(result.version).toBe(2)
  })

  it('enqueues no reminder or notification side effects on update (F10NO seam)', async () => {
    tx.event.updateMany.mockResolvedValueOnce({ count: 1 })
    tx.event.findFirst.mockResolvedValueOnce(eventRow({ version: 2 }))
    tx.auditLog.create.mockResolvedValueOnce({})

    await UPDATE_EVENT({
      churchId: 'church-1',
      churchIds: new Set(['church-1']),
      eventId: 'event-1',
      expectedVersion: 1,
      data: INPUT,
      actorId: 'user-1',
      requestId: 'request-1',
    })

    for (const model of [tx.outboxJob, tx.notificationDelivery]) {
      for (const fn of Object.values(model)) expect(fn).not.toHaveBeenCalled()
    }
  })

  it('rejects an out-of-scope church before opening a transaction', async () => {
    await expect(
      UPDATE_EVENT({
        churchId: 'church-9',
        churchIds: new Set(['church-1']),
        eventId: 'event-1',
        expectedVersion: 1,
        data: INPUT,
        actorId: 'user-1',
        requestId: 'request-1',
      }),
    ).rejects.toMatchObject({ code: 404, error_code: 'RESOURCE_NOT_FOUND' })

    expect(db.$transaction).not.toHaveBeenCalled()
    expect(tx.event.updateMany).not.toHaveBeenCalled()
  })

  it('returns STALE_VERSION and does not audit when the guarded update misses', async () => {
    tx.event.updateMany.mockResolvedValueOnce({ count: 0 })

    await expect(
      UPDATE_EVENT({
        churchId: 'church-1',
        churchIds: new Set(['church-1']),
        eventId: 'event-1',
        expectedVersion: 9,
        data: INPUT,
        actorId: 'user-1',
        requestId: 'request-1',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })

    expect(tx.event.findFirst).not.toHaveBeenCalled()
    expect(tx.auditLog.create).not.toHaveBeenCalled()
  })

  it('propagates audit failure from the same update transaction', async () => {
    tx.event.updateMany.mockResolvedValueOnce({ count: 1 })
    tx.event.findFirst.mockResolvedValueOnce(eventRow({ version: 2 }))
    tx.auditLog.create.mockRejectedValueOnce(new Error('audit unavailable'))

    await expect(
      UPDATE_EVENT({
        churchId: 'church-1',
        churchIds: new Set(['church-1']),
        eventId: 'event-1',
        expectedVersion: 1,
        data: INPUT,
        actorId: 'user-1',
        requestId: 'request-1',
      }),
    ).rejects.toThrow('audit unavailable')

    expect(db.$transaction).toHaveBeenCalledOnce()
  })
})
