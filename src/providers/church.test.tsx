// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  GET_CHURCH_VERSION,
  UPDATE_CHURCH_PROFILE,
  GET_CHURCH_OVERVIEW,
  GET_CHURCH_PROFILE,
  GET_REQUEST_OVERVIEW,
} from './church'
import { Prisma } from '@prisma/client'
import { CUSTOMER_ACCOUNT_FILTER } from '@/utils/customer-role'

const { db, tx } = vi.hoisted(() => {
  const txObj = {
    church: { updateMany: vi.fn(), findUnique: vi.fn() },
    churchLanguage: { deleteMany: vi.fn(), createMany: vi.fn() },
    churchGalleryItem: { deleteMany: vi.fn(), createMany: vi.fn() },
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
      request: { count: vi.fn(), findMany: vi.fn() },
      orgNode: { findMany: vi.fn().mockResolvedValue([]) },
      auditLog: { create: vi.fn() },
    },
  }
})

vi.mock('@/utils/db-connection', () => ({ db }))

describe('Church Provider', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.orgNode.findMany.mockResolvedValue([])
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

    it('resolves organization hierarchy path from org node map', async () => {
      db.church.findFirst.mockResolvedValue({
        id: 'c1',
        name: 'St. John',
        org_node_id: 'n-church',
        status: 'APPROVED',
        timezone: 'Europe/Tallinn',
        description: null,
        denomination: 'Lutheran',
        address: null,
        latitude: null,
        longitude: null,
        contacts: null,
        website: null,
        social_links: null,
        cover_asset_id: null,
        version: 1,
        churchLanguages: [],
      })
      db.orgNode.findMany.mockResolvedValue([
        { id: 'n-global', parent_id: null, kind: 'GLOBAL', name: 'Global', country_code: null },
        {
          id: 'n-country',
          parent_id: 'n-global',
          kind: 'COUNTRY',
          name: 'Estonia',
          country_code: 'EE',
        },
        {
          id: 'n-diocese',
          parent_id: 'n-country',
          kind: 'DIOCESE',
          name: 'Estonia Diocese',
          country_code: 'EE',
        },
        {
          id: 'n-deanery',
          parent_id: 'n-diocese',
          kind: 'DEANERY',
          name: 'Tallin Deanery',
          country_code: 'EE',
        },
        {
          id: 'n-church',
          parent_id: 'n-deanery',
          kind: 'CHURCH',
          name: 'St. John',
          country_code: 'EE',
        },
      ])

      const res = await GET_CHURCH_PROFILE({ churchId: 'c1', churchIds: new Set(['c1']) })
      expect(res?.organization).toEqual(['Estonia Diocese', 'Tallin Deanery'])
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
    it('replaces gallery items when provided in UPDATE_CHURCH_PROFILE', async () => {
      tx.church.updateMany.mockResolvedValueOnce({ count: 1 })
      tx.church.findUnique.mockResolvedValueOnce({
        id: 'c1',
        name: 'New Name',
        status: 'APPROVED',
        timezone: 'UTC',
        description: null,
        denomination: null,
        address: {},
        latitude: null,
        longitude: null,
        contacts: {},
        website: null,
        social_links: [],
        cover_asset_id: null,
        version: 4,
        churchLanguages: [],
        galleryItems: [
          {
            id: 'g1',
            media_asset_id: 'm1',
            caption: 'Altar',
            order_index: 0,
            media_asset: { id: 'm1', object_key: '/images/church.jpeg' },
          },
        ],
      })

      const result = await UPDATE_CHURCH_PROFILE({
        churchId: 'c1',
        churchIds: new Set(['c1']),
        expectedVersion: 3,
        payload,
        languageCodes: [],
        galleryItems: [{ mediaAssetId: 'm1', caption: 'Altar', orderIndex: 0 }],
        requestId: 'r1',
      })

      expect(tx.churchGalleryItem.deleteMany).toHaveBeenCalledWith({ where: { church_id: 'c1' } })
      expect(tx.churchGalleryItem.createMany).toHaveBeenCalledWith({
        data: [{ church_id: 'c1', media_asset_id: 'm1', caption: 'Altar', order_index: 0 }],
      })
      expect(result.galleryItems).toEqual([
        {
          id: 'g1',
          mediaAssetId: 'm1',
          caption: 'Altar',
          orderIndex: 0,
          url: '/images/church.jpeg',
        },
      ])
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
      db.announcement.count.mockResolvedValueOnce(5).mockResolvedValueOnce(8)
      db.userChurch.count.mockResolvedValueOnce(6)
      db.mediaAsset.count.mockResolvedValueOnce(7)

      const result = await GET_CHURCH_OVERVIEW({ churchId: 'c1', churchIds: new Set(['c2', 'c1']) })

      expect(db.serviceTime.count).toHaveBeenCalledWith({ where: { church_id: 'c1' } })
      expect(db.churchPastor.count).toHaveBeenCalledWith({ where: { church_id: 'c1' } })
      expect(db.prayer.count).toHaveBeenCalledWith({ where: { church_id: 'c1' } })
      expect(db.event.count).toHaveBeenCalledWith({ where: { church_id: 'c1' } })
      expect(db.announcement.count).toHaveBeenCalledWith({
        where: { church_id: 'c1', published_at: null, deleted_at: null },
      })
      expect(db.announcement.count).toHaveBeenCalledWith({
        where: { church_id: 'c1', published_at: { not: null }, deleted_at: null },
      })
      // Plan 022: the member count must exclude staff accounts that picked or
      // followed a parish on the website.
      expect(db.userChurch.count).toHaveBeenCalledWith({
        where: { church_id: 'c1', user: CUSTOMER_ACCOUNT_FILTER },
      })
      expect(db.mediaAsset.count).toHaveBeenCalledWith({ where: { church_id: 'c1' } })

      expect(result?.church.id).toBe('c1')
      expect(result?.church.city).toBe('Tallinn')
      expect(result?.aggregates.mediaCount).toBe(7)
      expect(result?.aggregates.announcementDraftCount).toBe(5)
      expect(result?.aggregates.announcementPublishedCount).toBe(8)
    })
  })
  describe('GET_REQUEST_OVERVIEW', () => {
    const recentRow = {
      id: 'r1',
      kind: 'PRAYER',
      classification: 'STANDARD',
      created_at: new Date('2026-01-01T00:00:00Z'),
    }

    it('hides private/restricted rows from count and recent for a standard reader', async () => {
      db.request.count.mockResolvedValueOnce(1)
      db.request.findMany.mockResolvedValueOnce([recentRow])

      const result = await GET_REQUEST_OVERVIEW({ churchId: 'c1', canReadPrivate: false })

      const where = {
        church_id: 'c1',
        kind: 'PRAYER',
        OR: [{ classification: null }, { classification: { not: 'PRIVATE' } }],
      }
      expect(db.request.count).toHaveBeenCalledWith({ where })
      expect(db.request.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }))
      expect(result).toEqual({
        total: 1,
        recent: [
          { id: 'r1', kind: 'prayer', classification: 'standard', createdAt: recentRow.created_at },
        ],
      })
    })

    it('counts every row of the exact church for a private reader', async () => {
      db.request.count.mockResolvedValueOnce(4)
      db.request.findMany.mockResolvedValueOnce([])

      await GET_REQUEST_OVERVIEW({ churchId: 'c1', canReadPrivate: true })

      expect(db.request.count).toHaveBeenCalledWith({ where: { church_id: 'c1' } })
    })
  })
})
