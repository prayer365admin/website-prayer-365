// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { db, tx } = vi.hoisted(() => {
  const txObj = {
    announcement: { updateMany: vi.fn(), findFirst: vi.fn() },
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
      announcement: {
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

import {
  DELETE_ANNOUNCEMENT,
  GET_ANNOUNCEMENT,
  GET_ANNOUNCEMENT_IN_SCOPE,
  LIST_ANNOUNCEMENTS,
  PUBLISH_ANNOUNCEMENT,
  UNPUBLISH_ANNOUNCEMENT,
  UPDATE_ANNOUNCEMENT,
} from './announcement'

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'announcement-1',
  church_id: 'church-1',
  title: 'News',
  body: 'Parish news',
  published_at: null,
  version: 1,
  created_at: new Date('2026-10-01T00:00:00Z'),
  ...overrides,
})

describe('Announcement Provider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('composes church, status, publication range, and search for count and rows', async () => {
    db.announcement.count.mockResolvedValueOnce(0)
    db.announcement.findMany.mockResolvedValueOnce([])

    await LIST_ANNOUNCEMENTS({
      churchIds: new Set(['church-1']),
      query: {
        page: 2,
        limit: 10,
        search: 'News',
        status: 'published',
        published_from: '2026-10-01T00:00:00.000Z',
        published_to: '2026-10-31T23:59:59.000Z',
        order_by: 'published_at',
        order_direction: 'desc',
      },
    })

    const where = {
      church_id: { in: ['church-1'] },
      deleted_at: null,
      title: { contains: 'News', mode: 'insensitive' },
      AND: [
        { published_at: { not: null } },
        {
          published_at: {
            gte: new Date('2026-10-01T00:00:00.000Z'),
            lte: new Date('2026-10-31T23:59:59.000Z'),
          },
        },
      ],
    }
    expect(db.announcement.count).toHaveBeenCalledWith({ where })
    expect(db.announcement.findMany).toHaveBeenCalledWith({
      where,
      take: 10,
      skip: 10,
      orderBy: [{ published_at: 'desc' }, { id: 'asc' }],
      include: { church: { select: { name: true, timezone: true } } },
    })
  })

  it('keeps contradictory draft and publication-date filters composed', async () => {
    db.announcement.count.mockResolvedValueOnce(0)
    db.announcement.findMany.mockResolvedValueOnce([])

    await LIST_ANNOUNCEMENTS({
      churchIds: new Set(['church-1']),
      query: {
        page: 1,
        limit: 25,
        status: 'draft',
        published_from: '2026-10-01T00:00:00.000Z',
        order_by: 'created_at',
        order_direction: 'desc',
      },
    })

    expect(db.announcement.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        AND: [
          { published_at: null },
          { published_at: { gte: new Date('2026-10-01T00:00:00.000Z') } },
        ],
      }),
    })
  })

  it('reads only the exact route church, independent of Set order', async () => {
    db.announcement.findFirst.mockResolvedValueOnce(row())

    await GET_ANNOUNCEMENT({
      churchId: 'church-1',
      churchIds: new Set(['church-9', 'church-1']),
      announcementId: 'announcement-1',
    })

    expect(db.announcement.findFirst).toHaveBeenCalledWith({
      where: { id: 'announcement-1', church_id: 'church-1', deleted_at: null },
    })
  })

  it('does not query an announcement when the route church is outside scope', async () => {
    await expect(
      GET_ANNOUNCEMENT({
        churchId: 'church-9',
        churchIds: new Set(['church-1']),
        announcementId: 'announcement-1',
      }),
    ).resolves.toBeNull()

    expect(db.announcement.findFirst).not.toHaveBeenCalled()
  })

  it('updates the exact church, returns it to draft, and sends no reminder', async () => {
    tx.announcement.updateMany.mockResolvedValueOnce({ count: 1 })
    tx.announcement.findFirst.mockResolvedValueOnce(row({ version: 2 }))
    tx.auditLog.create.mockResolvedValueOnce({})

    await UPDATE_ANNOUNCEMENT({
      churchId: 'church-1',
      churchIds: new Set(['church-9', 'church-1']),
      announcementId: 'announcement-1',
      expectedVersion: 1,
      data: { title: 'Updated', body: 'Updated body', version: 1 },
      actorId: 'user-1',
      requestId: 'request-1',
    })

    expect(tx.announcement.updateMany).toHaveBeenCalledWith({
      where: { id: 'announcement-1', church_id: 'church-1', version: 1, deleted_at: null },
      data: expect.objectContaining({
        title: 'Updated',
        body: 'Updated body',
        // Editing a published announcement returns it to Draft.
        published_at: null,
        version: { increment: 1 },
      }),
    })
    for (const model of [tx.outboxJob, tx.notificationDelivery]) {
      for (const fn of Object.values(model)) expect(fn).not.toHaveBeenCalled()
    }
  })

  it('publishes the exact church immediately and increments the version', async () => {
    tx.announcement.updateMany.mockResolvedValueOnce({ count: 1 })
    tx.announcement.findFirst.mockResolvedValueOnce(
      row({ version: 2, published_at: new Date('2026-10-06T00:00:00Z') }),
    )
    tx.auditLog.create.mockResolvedValueOnce({})

    const result = await PUBLISH_ANNOUNCEMENT({
      churchId: 'church-1',
      churchIds: new Set(['church-9', 'church-1']),
      announcementId: 'announcement-1',
      expectedVersion: 1,
      actorId: 'user-1',
      requestId: 'request-1',
    })

    expect(tx.announcement.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'announcement-1',
        church_id: 'church-1',
        version: 1,
        published_at: null,
        deleted_at: null,
      },
      data: expect.objectContaining({
        published_at: expect.any(Date),
        version: { increment: 1 },
      }),
    })
    expect(result).toMatchObject({ churchId: 'church-1', version: 2 })
    expect(tx.outboxJob.create).toHaveBeenCalledWith({
      data: {
        kind: 'notification.send',
        dedupe_key: 'notification.send:announcement_published:announcement-1:2',
        resource_id: 'announcement-1',
        payload: { type: 'announcement_published', churchId: 'church-1' },
        available_at: expect.any(Date),
      },
    })
  })

  it('unpublishes the exact church and increments the version', async () => {
    tx.announcement.updateMany.mockResolvedValueOnce({ count: 1 })
    tx.announcement.findFirst.mockResolvedValueOnce(row({ version: 3, published_at: null }))
    tx.auditLog.create.mockResolvedValueOnce({})

    const result = await UNPUBLISH_ANNOUNCEMENT({
      churchId: 'church-1',
      churchIds: new Set(['church-9', 'church-1']),
      announcementId: 'announcement-1',
      expectedVersion: 2,
      actorId: 'user-1',
      requestId: 'request-1',
    })

    expect(tx.announcement.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'announcement-1',
        church_id: 'church-1',
        version: 2,
        published_at: { not: null },
        deleted_at: null,
      },
      data: {
        published_at: null,
        version: { increment: 1 },
        updated_at: expect.any(Date),
      },
    })
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'announcement.unpublish' }),
    })
    expect(result).toMatchObject({ publishedAt: null, version: 3 })
  })

  it('returns STALE_VERSION when unpublish is repeated or loses a race', async () => {
    tx.announcement.updateMany.mockResolvedValueOnce({ count: 0 })

    await expect(
      UNPUBLISH_ANNOUNCEMENT({
        churchId: 'church-1',
        churchIds: new Set(['church-1']),
        announcementId: 'announcement-1',
        expectedVersion: 3,
        actorId: 'user-1',
        requestId: 'request-1',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })

    expect(tx.announcement.findFirst).not.toHaveBeenCalled()
    expect(tx.auditLog.create).not.toHaveBeenCalled()
  })

  it('rejects an out-of-scope update before opening a transaction', async () => {
    await expect(
      UPDATE_ANNOUNCEMENT({
        churchId: 'church-9',
        churchIds: new Set(['church-1']),
        announcementId: 'announcement-1',
        expectedVersion: 1,
        data: { title: 'Updated', body: 'Updated body', version: 1 },
        actorId: 'user-1',
        requestId: 'request-1',
      }),
    ).rejects.toMatchObject({ code: 404, error_code: 'RESOURCE_NOT_FOUND' })

    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('rejects an out-of-scope publish before opening a transaction', async () => {
    await expect(
      PUBLISH_ANNOUNCEMENT({
        churchId: 'church-9',
        churchIds: new Set(['church-1']),
        announcementId: 'announcement-1',
        expectedVersion: 1,
        actorId: 'user-1',
        requestId: 'request-1',
      }),
    ).rejects.toMatchObject({ code: 404, error_code: 'RESOURCE_NOT_FOUND' })

    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('returns STALE_VERSION without reading or auditing when update loses a race', async () => {
    tx.announcement.updateMany.mockResolvedValueOnce({ count: 0 })

    await expect(
      UPDATE_ANNOUNCEMENT({
        churchId: 'church-1',
        churchIds: new Set(['church-1']),
        announcementId: 'announcement-1',
        expectedVersion: 9,
        data: { title: 'Updated', body: 'Updated body', version: 9 },
        actorId: 'user-1',
        requestId: 'request-1',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })

    expect(tx.announcement.findFirst).not.toHaveBeenCalled()
    expect(tx.auditLog.create).not.toHaveBeenCalled()
  })

  it('returns STALE_VERSION without reading or auditing when publish loses a race', async () => {
    tx.announcement.updateMany.mockResolvedValueOnce({ count: 0 })

    await expect(
      PUBLISH_ANNOUNCEMENT({
        churchId: 'church-1',
        churchIds: new Set(['church-1']),
        announcementId: 'announcement-1',
        expectedVersion: 9,
        actorId: 'user-1',
        requestId: 'request-1',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })

    expect(tx.announcement.findFirst).not.toHaveBeenCalled()
    expect(tx.auditLog.create).not.toHaveBeenCalled()
  })

  it('propagates audit failure from the same update transaction', async () => {
    tx.announcement.updateMany.mockResolvedValueOnce({ count: 1 })
    tx.announcement.findFirst.mockResolvedValueOnce(row({ version: 2 }))
    tx.auditLog.create.mockRejectedValueOnce(new Error('audit unavailable'))

    await expect(
      UPDATE_ANNOUNCEMENT({
        churchId: 'church-1',
        churchIds: new Set(['church-1']),
        announcementId: 'announcement-1',
        expectedVersion: 1,
        data: { title: 'Updated', body: 'Updated body', version: 1 },
        actorId: 'user-1',
        requestId: 'request-1',
      }),
    ).rejects.toThrow('audit unavailable')

    expect(db.$transaction).toHaveBeenCalledOnce()
  })

  describe('GET_ANNOUNCEMENT_IN_SCOPE', () => {
    it('finds by id only within the scope churches and includes the church', async () => {
      db.announcement.findFirst.mockResolvedValueOnce(null)

      const result = await GET_ANNOUNCEMENT_IN_SCOPE({
        churchIds: new Set(['c1', 'c2']),
        announcementId: 'a1',
      })

      expect(result).toBeNull()
      expect(db.announcement.findFirst).toHaveBeenCalledWith({
        where: { id: 'a1', church_id: { in: ['c1', 'c2'] }, deleted_at: null },
        include: { church: { select: { name: true, timezone: true } } },
      })
    })
  })

  describe('DELETE_ANNOUNCEMENT', () => {
    it('soft-deletes the exact church row at the expected version and audits it', async () => {
      tx.announcement.updateMany.mockResolvedValueOnce({ count: 1 })
      tx.auditLog.create.mockResolvedValueOnce({})

      await DELETE_ANNOUNCEMENT({
        churchId: 'church-1',
        churchIds: new Set(['church-1']),
        announcementId: 'announcement-1',
        expectedVersion: 4,
        actorId: 'user-1',
        requestId: 'request-1',
      })

      expect(tx.announcement.updateMany).toHaveBeenCalledWith({
        where: { id: 'announcement-1', church_id: 'church-1', version: 4, deleted_at: null },
        data: {
          deleted_at: expect.any(Date),
          version: { increment: 1 },
          updated_at: expect.any(Date),
        },
      })
      expect(tx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'announcement.delete',
          resource_id: 'announcement-1',
        }),
      })
    })

    it('rejects a stale or already deleted row without auditing', async () => {
      tx.announcement.updateMany.mockResolvedValueOnce({ count: 0 })

      await expect(
        DELETE_ANNOUNCEMENT({
          churchId: 'church-1',
          churchIds: new Set(['church-1']),
          announcementId: 'announcement-1',
          expectedVersion: 4,
          actorId: 'user-1',
          requestId: 'request-1',
        }),
      ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
      expect(tx.auditLog.create).not.toHaveBeenCalled()
    })

    it('refuses a church outside the scope without touching the database', async () => {
      await expect(
        DELETE_ANNOUNCEMENT({
          churchId: 'church-2',
          churchIds: new Set(['church-1']),
          announcementId: 'announcement-1',
          expectedVersion: 4,
          actorId: 'user-1',
          requestId: 'request-1',
        }),
      ).rejects.toMatchObject({ code: 404 })
      expect(db.$transaction).not.toHaveBeenCalled()
    })
  })
})
