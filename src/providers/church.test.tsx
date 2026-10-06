// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  GET_CHURCH_VERSION,
  UPDATE_CHURCH_PROFILE,
  GET_CHURCH_OVERVIEW,
  GET_CHURCH_PROFILE,
} from './church'
import { Prisma } from '@prisma/client'

const { db, tx } = vi.hoisted(() => {
  const txObj = {
    church: { updateMany: vi.fn(), findUnique: vi.fn() },
    churchLanguage: { deleteMany: vi.fn(), createMany: vi.fn() },
    auditLog: { create: vi.fn() },
  }
  return {
    tx: txObj,
    db: {
      $transaction: vi.fn(async (arg: unknown) =>
        Array.isArray(arg)
          ? Promise.all(arg as Promise<unknown>[])
          : (arg as (t: unknown) => unknown)(txObj),
      ),
      church: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
      },
      churchLanguage: { deleteMany: vi.fn(), createMany: vi.fn() },
      language: { findMany: vi.fn() },
      mediaAsset: { findFirst: vi.fn(), count: vi.fn() },
      serviceTime: { count: vi.fn() },
      churchPastor: { count: vi.fn() },
      prayer: { count: vi.fn() },
      event: { count: vi.fn() },
      announcement: { count: vi.fn() },
      userChurch: { count: vi.fn() },
      auditLog: { create: vi.fn() },
    },
  }
})

vi.mock('@/utils/db-connection', () => ({ db }))

describe('Church Provider', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('GET_CHURCH_PROFILE', () => {
    it('filters out disabled languages from the church profile', async () => {
      db.church.findFirst.mockResolvedValue({
        id: 'c1',
        name: 'Test Church',
        status: 'APPROVED',
        timezone: 'UTC',
        description: null,
        denomination: null,
        address: null,
        latitude: null,
        longitude: null,
        contacts: null,
        website: null,
        social_links: null,
        accessibility: null,
        cover_asset_id: null,
        version: 1,
        churchLanguages: [{ language_code: 'en' }],
      })

      await GET_CHURCH_PROFILE({ churchId: 'c1', churchIds: new Set(['c1']) })

      expect(db.church.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ id: 'c1' }, { id: { in: ['c1'] } }] },
          include: expect.objectContaining({
            churchLanguages: expect.objectContaining({
              where: { language: { enabled: true } },
              select: { language_code: true },
            }),
          }),
        }),
      )
    })
  })

  describe('UPDATE_CHURCH_PROFILE', () => {
    const payload: Prisma.ChurchUncheckedUpdateInput = { name: 'New Name' }

    it('aborts with 409 STALE_VERSION when the version guard misses', async () => {
      tx.church.updateMany.mockResolvedValueOnce({ count: 0 })

      await expect(
        UPDATE_CHURCH_PROFILE({
          churchId: 'c1',
          churchIds: new Set(['c1']),
          expectedVersion: 3,
          payload,
          languageCodes: ['en'],
          requestId: 'req-1',
          actorId: 'user-1',
        }),
      ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })

      expect(tx.churchLanguage.deleteMany).not.toHaveBeenCalled()
      expect(tx.churchLanguage.createMany).not.toHaveBeenCalled()
      expect(tx.auditLog.create).not.toHaveBeenCalled()
    })

    it('bumps version, replaces languages, audits, and returns the mapped profile with filtered languages', async () => {
      tx.church.updateMany.mockResolvedValueOnce({ count: 1 })
      tx.church.findUnique.mockResolvedValueOnce({
        id: 'c1',
        name: 'New Name',
        status: 'APPROVED',
        timezone: 'UTC',
        description: null,
        denomination: null,
        address: null,
        latitude: 1,
        longitude: 2,
        contacts: null,
        website: null,
        social_links: null,
        accessibility: null,
        cover_asset_id: null,
        version: 4,
        churchLanguages: [{ language_code: 'en' }],
      })

      const result = await UPDATE_CHURCH_PROFILE({
        churchId: 'c1',
        churchIds: new Set(['c1']),
        expectedVersion: 3,
        payload,
        languageCodes: ['en'],
        requestId: 'req-1',
        actorId: 'user-1',
      })

      expect(tx.church.updateMany).toHaveBeenCalledWith({
        where: { AND: [{ id: 'c1' }, { id: { in: ['c1'] } }, { version: 3 }] },
        data: expect.objectContaining({
          name: 'New Name',
          version: { increment: 1 },
          updated_at: expect.any(Date),
        }),
      })

      expect(tx.churchLanguage.deleteMany).toHaveBeenCalledWith({ where: { church_id: 'c1' } })
      expect(tx.churchLanguage.createMany).toHaveBeenCalledWith({
        data: [{ church_id: 'c1', language_code: 'en' }],
      })
      expect(tx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'church.profile.update',
        }),
      })

      expect(tx.church.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          include: expect.objectContaining({
            churchLanguages: expect.objectContaining({
              where: { language: { enabled: true } },
              select: { language_code: true },
            }),
          }),
        }),
      )

      expect(result.coordinates).toEqual({ latitude: 1, longitude: 2 })
      expect(result.languageCodes).toEqual(['en'])
      expect(result.version).toBe(4)
    })

    it('targets the requested churchId, not ids[0]', async () => {
      tx.church.updateMany.mockResolvedValueOnce({ count: 1 })
      tx.church.findUnique.mockResolvedValueOnce({
        id: 'c1',
        name: 'New Name',
        status: 'APPROVED',
        timezone: 'UTC',
        description: null,
        denomination: null,
        address: null,
        latitude: null,
        longitude: null,
        contacts: null,
        website: null,
        social_links: null,
        accessibility: null,
        cover_asset_id: null,
        version: 4,
        churchLanguages: [],
      })

      await UPDATE_CHURCH_PROFILE({
        churchId: 'c1',
        churchIds: new Set(['c9', 'c1']),
        expectedVersion: 3,
        payload,
        languageCodes: [],
        requestId: 'req-1',
        actorId: 'user-1',
      })

      expect(tx.church.updateMany).toHaveBeenCalledWith({
        where: { AND: [{ id: 'c1' }, { id: { in: ['c9', 'c1'] } }, { version: 3 }] },
        data: expect.any(Object),
      })
    })

    it('throws 404 on empty scope', async () => {
      await expect(
        UPDATE_CHURCH_PROFILE({
          churchId: 'c1',
          churchIds: new Set(),
          expectedVersion: 3,
          payload,
          languageCodes: [],
          requestId: 'req-1',
          actorId: 'user-1',
        }),
      ).rejects.toMatchObject({ code: 404 })
    })
  })

  describe('GET_CHURCH_VERSION', () => {
    it('returns null for an out-of-scope church', async () => {
      db.church.findFirst.mockResolvedValueOnce(null)
      const version = await GET_CHURCH_VERSION({ churchId: 'c1', churchIds: new Set(['c1']) })
      expect(version).toBeNull()
    })

    it('reads only the requested church', async () => {
      db.church.findFirst.mockResolvedValueOnce({ version: 5 })
      const version = await GET_CHURCH_VERSION({ churchId: 'c1', churchIds: new Set(['c2', 'c1']) })
      expect(version).toBe(5)
      expect(db.church.findFirst).toHaveBeenCalledWith({
        where: { AND: [{ id: 'c1' }, { id: { in: ['c2', 'c1'] } }] },
        select: { version: true },
      })
    })
  })

  describe('GET_CHURCH_OVERVIEW', () => {
    it('aggregates only the requested church', async () => {
      db.church.findFirst.mockResolvedValueOnce({
        id: 'c1',
        name: 'Church',
        status: 'APPROVED',
        timezone: 'UTC',
        address: { city: 'Tallinn' },
        version: 3,
      })

      db.serviceTime.count.mockResolvedValueOnce(1)
      db.churchPastor.count.mockResolvedValueOnce(2)
      db.prayer.count.mockResolvedValueOnce(3)
      db.event.count.mockResolvedValueOnce(4)
      db.announcement.count.mockResolvedValueOnce(5)
      db.userChurch.count.mockResolvedValueOnce(6)
      db.mediaAsset.count.mockResolvedValueOnce(7)

      const result = await GET_CHURCH_OVERVIEW({ churchId: 'c1', churchIds: new Set(['c2', 'c1']) })

      expect(db.serviceTime.count).toHaveBeenCalledWith({ where: { church_id: 'c1' } })
      expect(db.churchPastor.count).toHaveBeenCalledWith({ where: { church_id: 'c1' } })
      expect(db.prayer.count).toHaveBeenCalledWith({ where: { church_id: 'c1' } })
      expect(db.event.count).toHaveBeenCalledWith({ where: { church_id: 'c1' } })
      expect(db.announcement.count).toHaveBeenCalledWith({ where: { church_id: 'c1' } })
      expect(db.userChurch.count).toHaveBeenCalledWith({ where: { church_id: 'c1' } })
      expect(db.mediaAsset.count).toHaveBeenCalledWith({ where: { church_id: 'c1' } })

      expect(result?.church.id).toBe('c1')
      expect(result?.church.city).toBe('Tallinn')
      expect(result?.aggregates.mediaCount).toBe(7)
    })
  })
})
