import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MobilePublicChurchSchema } from '@/models/mobile'

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  church: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  userChurch: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
  prayer: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  prayerVersion: { findMany: vi.fn(), findFirst: vi.fn() },
  event: { count: vi.fn(), findMany: vi.fn() },
  announcement: { count: vi.fn(), findMany: vi.fn() },
  checkIn: { createMany: vi.fn(), findFirst: vi.fn() },
  mediaAsset: { findFirst: vi.fn() },
  analyticsEvent: { createMany: vi.fn() },
  request: { count: vi.fn(), findFirst: vi.fn() },
  auditLog: { create: vi.fn() },
}))

vi.mock('@/utils/db-connection', () => ({ db }))

// Bucket is public-read for now (SPEC §10.4.1 / D13): covers come from S3_PUBLIC_URL.
const s3 = vi.hoisted(() => ({ S3_PUBLIC_URL: vi.fn() }))
vi.mock('@/providers/s3', () => ({ S3_PUBLIC_URL: s3.S3_PUBLIC_URL }))

import {
  churchLocalDate,
  isOpenNow,
  CREATE_CHECKIN,
  UPDATE_ME_PROFILE,
  GET_HOME,
  GET_PUBLIC_CHURCH,
  GET_PUBLISHED_PRAYER,
  LIST_MY_CHURCHES,
  LIST_PUBLIC_CHURCHES,
  LIST_PUBLIC_ANNOUNCEMENTS,
  LIST_PUBLIC_EVENTS,
  LIST_PUBLISHED_PRAYERS,
  COUNT_RECENT_USER_REQUESTS,
  CREATE_USER_REQUEST,
  GET_USER_REQUEST_ACK,
} from './mobile'

beforeEach(() => {
  vi.clearAllMocks()
  s3.S3_PUBLIC_URL.mockImplementation(({ key }: { key: string }) => `https://cdn.test/${key}`)
  db.mediaAsset.findFirst.mockResolvedValue(null)
})

describe('churchLocalDate (D7 local-day foundation)', () => {
  it('returns a UTC calendar date for a UTC church', () => {
    expect(churchLocalDate(new Date('2026-01-02T23:30:00.000Z'), 'UTC')).toBe('2026-01-02')
  })

  it('returns a different local date for a non-UTC timezone', () => {
    // 2026-01-02T23:30Z in Asia/Makassar (+08) is 2026-01-03
    expect(churchLocalDate(new Date('2026-01-02T23:30:00.000Z'), 'Asia/Makassar')).toBe(
      '2026-01-03',
    )
  })

  it('falls back to UTC on an invalid timezone', () => {
    expect(churchLocalDate(new Date('2026-01-02T10:00:00.000Z'), 'Not/AZone')).toBe('2026-01-02')
  })
})

describe('CREATE_CHECKIN — D7 dedupe (one user/church/local-day)', () => {
  it('builds a deterministic dedupe_key and reuses an existing row on duplicate', async () => {
    db.church.findFirst.mockResolvedValue({ id: 'c1', timezone: 'UTC' })
    db.checkIn.createMany.mockResolvedValue({ count: 0 })
    db.checkIn.findFirst.mockResolvedValue({
      id: 'existing-ck',
      church_id: 'c1',
      user_id: 'u1',
      occurred_at: new Date('2026-01-01T00:00:00Z'),
      local_date: new Date('2026-01-01'),
    })
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'))

    const res = await CREATE_CHECKIN({ churchId: 'c1', userId: 'u1', requestId: 'r' })

    // Dedupe key is user/church/local-date; duplicate returns the existing row => idempotent
    expect(db.checkIn.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: expect.objectContaining({ dedupe_key: 'u1:c1:2026-01-01' }),
      }),
    )
    expect(res.id).toBe('existing-ck')
    expect(res.localDate).toBe('2026-01-01')
    vi.useRealTimers()
  })

  it('returns the freshly inserted row when this is a first check-in', async () => {
    db.church.findFirst.mockResolvedValue({ id: 'c1', timezone: 'UTC' })
    db.checkIn.createMany.mockResolvedValue({ count: 1 })
    db.checkIn.findFirst.mockResolvedValue({
      id: 'new-ck',
      church_id: 'c1',
      user_id: 'u1',
      occurred_at: new Date('2026-01-01T12:00:00Z'),
      local_date: new Date('2026-01-01'),
    })
    const res = await CREATE_CHECKIN({ churchId: 'c1', userId: 'u1', requestId: 'r' })
    expect(res.id).toBe('new-ck')
  })

  it('throws 404 for a non-approved church', async () => {
    db.church.findFirst.mockResolvedValue(null)
    await expect(
      CREATE_CHECKIN({ churchId: 'c-suspended', userId: 'u1', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 404 })
  })
})

describe('UPDATE_ME_PROFILE — main-church is exactly one row', () => {
  const tx = {
    user: { update: vi.fn(), updateMany: vi.fn() },
    church: { findFirst: vi.fn() },
    userChurch: { updateMany: vi.fn(), upsert: vi.fn() },
  }

  it('records the onboarding parish step once when a church is chosen', async () => {
    vi.clearAllMocks()
    db.$transaction.mockImplementation(async (fn) => fn(tx))
    tx.church.findFirst.mockResolvedValue({ id: 'c2' })

    await UPDATE_ME_PROFILE({ userId: 'u1', mainChurchId: 'c2' })

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', church_setup_completed_at: null },
      data: { church_setup_completed_at: expect.any(Date) },
    })
  })

  it('a skipped parish (null) leaves the parish step unfilled', async () => {
    vi.clearAllMocks()
    db.$transaction.mockImplementation(async (fn) => fn(tx))

    await UPDATE_ME_PROFILE({ userId: 'u1', mainChurchId: null })

    expect(tx.user.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { church_setup_completed_at: expect.any(Date) } }),
    )
  })

  it('records the language step once when a locale is chosen, not when skipped', async () => {
    vi.clearAllMocks()
    db.$transaction.mockImplementation(async (fn) => fn(tx))

    await UPDATE_ME_PROFILE({ userId: 'u1', locale: 'fi' })
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', locale_setup_completed_at: null },
      data: { locale_setup_completed_at: expect.any(Date) },
    })

    vi.clearAllMocks()
    db.$transaction.mockImplementation(async (fn) => fn(tx))
    await UPDATE_ME_PROFILE({ userId: 'u1', locale: 'en', localeChosen: false })
    expect(tx.user.updateMany).not.toHaveBeenCalled()
  })

  it('does not touch the parish step when the main church is not in the patch', async () => {
    vi.clearAllMocks()
    db.$transaction.mockImplementation(async (fn) => fn(tx))

    await UPDATE_ME_PROFILE({ userId: 'u1', name: 'Maria' })

    expect(tx.user.updateMany).not.toHaveBeenCalled()
  })

  it('clears prior is_main flags then sets the new main church inside one transaction', async () => {
    db.$transaction.mockImplementation(async (fn) => fn(tx))
    tx.church.findFirst.mockResolvedValue({ id: 'c2' })

    await UPDATE_ME_PROFILE({ userId: 'u1', mainChurchId: 'c2' })

    expect(tx.userChurch.updateMany).toHaveBeenCalledWith({
      where: { user_id: 'u1' },
      data: { is_main: false },
    })
    expect(tx.userChurch.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id_church_id: { user_id: 'u1', church_id: 'c2' } },
        create: expect.objectContaining({ is_main: true }),
        update: expect.objectContaining({ is_main: true }),
      }),
    )
  })

  it('throws 404 when the new main church is not approved', async () => {
    db.$transaction.mockImplementation(async (fn) => fn(tx))
    tx.church.findFirst.mockResolvedValue(null)
    await expect(
      UPDATE_ME_PROFILE({ userId: 'u1', mainChurchId: 'c-pending' }),
    ).rejects.toMatchObject({ code: 404 })
    expect(tx.userChurch.upsert).not.toHaveBeenCalled()
  })

  it('writes profile_picture; explicit null clears it', async () => {
    db.$transaction.mockImplementation(async (fn) => fn(tx))
    await UPDATE_ME_PROFILE({ userId: 'u1', profilePicture: 'https://cdn.example.com/a.png' })
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({ profile_picture: 'https://cdn.example.com/a.png' }),
    })

    await UPDATE_ME_PROFILE({ userId: 'u1', profilePicture: null })
    expect(tx.user.update).toHaveBeenLastCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({ profile_picture: null }),
    })
  })

  it('leaves profile_picture untouched when the field is absent', async () => {
    db.$transaction.mockImplementation(async (fn) => fn(tx))
    await UPDATE_ME_PROFILE({ userId: 'u1', name: 'A' })
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({ profile_picture: undefined }),
    })
  })
})

describe('GET_PUBLIC_CHURCH — admin profile reflected in mobile contract', () => {
  it('reflects every admin-edited profile field on the public DTO', async () => {
    db.church.findFirst.mockResolvedValueOnce({
      id: 'c1',
      name: 'Grace Renamed',
      denomination: 'Lutheran',
      description: 'Updated description',
      timezone: 'Europe/Tallinn',
      address: {
        line1: '1 St',
        line2: 'B',
        city: 'Tallinn',
        postalCode: '10111',
        countryCode: 'EE',
      },
      latitude: 59.437,
      longitude: 24.754,
      contacts: { email: 'office@grace.ee', phone: '+372 555' },
      website: 'https://grace.ee',
      social_links: [{ label: 'site', url: 'https://grace.ee' }],
      accessibility: 'Step-free entrance',
      cover_asset_id: 'm1',
      churchLanguages: [{ language_code: 'et' }, { language_code: 'en' }],
      serviceTimes: [
        { weekday: 1, local_time: new Date(Date.UTC(1970, 0, 1, 9, 0)), language_code: 'et' },
      ],
    })

    const result = await GET_PUBLIC_CHURCH({ churchId: 'c1' })
    expect(result).not.toBeNull()
    expect(result?.id).toBe('c1')
    expect(result?.name).toBe('Grace Renamed')
    expect(result?.denomination).toBe('Lutheran')
    expect(result?.description).toBe('Updated description')
    expect(result?.timezone).toBe('Europe/Tallinn')
    expect(result?.address).toEqual({
      line1: '1 St',
      line2: 'B',
      city: 'Tallinn',
      postalCode: '10111',
      countryCode: 'EE',
    })
    expect(result?.coordinates).toEqual({ latitude: 59.437, longitude: 24.754 })
    expect(result?.contacts).toEqual({ email: 'office@grace.ee', phone: '+372 555' })
    expect(result?.website).toBe('https://grace.ee')
    expect(result?.socialLinks).toEqual([{ label: 'site', url: 'https://grace.ee' }])
    expect(result?.accessibility).toBe('Step-free entrance')
    expect(result?.coverAssetId).toBe('m1')
    expect(result?.languageCodes).toEqual(['et', 'en'])
    expect(result?.serviceTimes[0].weekday).toBe(1)
    // MB-10: HH:MM church wall clock, not an ISO instant
    expect(result?.serviceTimes[0].localTime).toBe('09:00')
    expect(result?.serviceTimes[0].localTime).toMatch(/^\d{2}:\d{2}$/)
    expect(result?.serviceTimes[0].languageCode).toBe('et')
    // cover_asset_id present but the asset is not READY -> no URL
    expect(result?.coverUrl).toBeNull()
  })

  it('never exposes private/server-owned fields', async () => {
    db.church.findFirst.mockResolvedValueOnce({
      id: 'c1',
      name: 'Grace',
      timezone: 'UTC',
      status: 'APPROVED',
      approved_by: 'u1',
      approved_at: new Date(),
      version: 4,
      churchLanguages: [],
      serviceTimes: [],
    })

    const result = await GET_PUBLIC_CHURCH({ churchId: 'c1' })
    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty('status')
    expect(result).not.toHaveProperty('approved_by')
    expect(result).not.toHaveProperty('approved_at')
    expect(result).not.toHaveProperty('version')
  })

  it('returns null when the church is not APPROVED', async () => {
    db.church.findFirst.mockResolvedValueOnce(null)
    const result = await GET_PUBLIC_CHURCH({ churchId: 'c1' })
    expect(result).toBeNull()
  })

  it('queries with status APPROVED and church id in where-clause', async () => {
    db.church.findFirst.mockResolvedValueOnce(null)
    await GET_PUBLIC_CHURCH({ churchId: 'c1' })
    expect(db.church.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'c1',
          status: 'APPROVED',
        }),
      }),
    )
  })

  it('reflects gallery items ordered, with image urls and null when asset is missing', async () => {
    db.church.findFirst.mockResolvedValueOnce({
      id: 'c1',
      name: 'Grace',
      timezone: 'UTC',
      churchLanguages: [],
      serviceTimes: [],
      galleryItems: [
        {
          caption: 'Altar',
          order_index: 0,
          media_asset: { id: 'm1', object_key: 'churches/c1/altar.jpg' },
        },
        {
          caption: 'Nave',
          order_index: 1,
          media_asset: null,
        },
      ],
    })

    const result = await GET_PUBLIC_CHURCH({ churchId: 'c1' })
    expect(result?.gallery).toEqual([
      {
        assetId: 'm1',
        url: 'https://cdn.test/churches/c1/altar.jpg',
        caption: 'Altar',
        orderIndex: 0,
      },
      {
        assetId: '',
        url: null,
        caption: 'Nave',
        orderIndex: 1,
      },
    ])
  })

  it('reflects staff items with church override image first, canonical pastor fallback, and null when neither', async () => {
    db.church.findFirst.mockResolvedValueOnce({
      id: 'c1',
      name: 'Grace',
      timezone: 'UTC',
      churchLanguages: [],
      serviceTimes: [],
      pastors: [
        {
          pastoral_role: 'Senior Pastor',
          image_asset: { object_key: 'churches/c1/override.jpg' },
          pastor: {
            name: 'Pastor John',
            image_asset: { object_key: 'pastors/p1/canonical.jpg' },
          },
        },
        {
          pastoral_role: 'Associate Pastor',
          image_asset: null,
          pastor: {
            name: 'Pastor Jane',
            image_asset: { object_key: 'pastors/p2/canonical.jpg' },
          },
        },
        {
          pastoral_role: 'Youth Leader',
          image_asset: null,
          pastor: {
            name: 'Leader Sam',
            image_asset: null,
          },
        },
      ],
    })

    const result = await GET_PUBLIC_CHURCH({ churchId: 'c1' })
    expect(result?.staff).toEqual([
      {
        name: 'Pastor John',
        pastoralRole: 'Senior Pastor',
        imageUrl: 'https://cdn.test/churches/c1/override.jpg',
      },
      {
        name: 'Pastor Jane',
        pastoralRole: 'Associate Pastor',
        imageUrl: 'https://cdn.test/pastors/p2/canonical.jpg',
      },
      {
        name: 'Leader Sam',
        pastoralRole: 'Youth Leader',
        imageUrl: null,
      },
    ])
    for (const member of result?.staff ?? []) {
      expect(member).not.toHaveProperty('email')
      expect(member).not.toHaveProperty('phone')
      expect(member).not.toHaveProperty('contacts')
    }
  })

  it('emits sanctuaryHours and resolves deaneryName when parent kind is DEANERY', async () => {
    db.church.findFirst.mockResolvedValueOnce({
      id: 'c1',
      name: 'Grace',
      timezone: 'UTC',
      sanctuary_hours: '10:00–18:30 daily',
      churchLanguages: [],
      serviceTimes: [],
      org_node: {
        parent: {
          kind: 'DEANERY',
          name: 'Tallinn Deanery',
        },
      },
    })

    const result = await GET_PUBLIC_CHURCH({ churchId: 'c1' })
    expect(result?.sanctuaryHours).toBe('10:00–18:30 daily')
    expect(result?.deaneryName).toBe('Tallinn Deanery')
  })

  it('emits null for deaneryName and sanctuaryHours when absent or parent is not DEANERY', async () => {
    db.church.findFirst.mockResolvedValueOnce({
      id: 'c1',
      name: 'Grace',
      timezone: 'UTC',
      sanctuary_hours: null,
      churchLanguages: [],
      serviceTimes: [],
      org_node: {
        parent: {
          kind: 'DIOCESE',
          name: 'North Diocese',
        },
      },
    })

    const result = await GET_PUBLIC_CHURCH({ churchId: 'c1' })
    expect(result?.sanctuaryHours).toBeNull()
    expect(result?.deaneryName).toBeNull()
  })

  it('GET_PUBLIC_CHURCH result conforms to MobilePublicChurchSchema', async () => {
    db.church.findFirst.mockResolvedValueOnce({
      id: 'c1',
      name: 'Grace',
      denomination: null,
      description: null,
      timezone: 'UTC',
      latitude: null,
      longitude: null,
      address: { line1: '1 St', line2: null, city: 'Tallinn', postalCode: null, countryCode: 'EE' },
      contacts: { email: null, phone: null },
      website: null,
      social_links: [],
      accessibility: null,
      cover_asset_id: null,
      sanctuary_hours: null,
      churchLanguages: [],
      serviceTimes: [],
      galleryItems: [],
      pastors: [],
    })

    const result = await GET_PUBLIC_CHURCH({ churchId: 'c1' })
    const parsed = MobilePublicChurchSchema.safeParse(result)
    expect(parsed.success).toBe(true)
  })

  it('includes only fields and relations that exist in generated Prisma.dmmf', () => {
    const churchModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Church')
    expect(churchModel).toBeDefined()
    const fieldNames = (churchModel?.fields ?? []).map((f) => f.name)

    expect(fieldNames.includes('sanctuary_hours')).toBe(true)
    expect(fieldNames.includes('galleryItems')).toBe(true)
    expect(fieldNames.includes('pastors')).toBe(true)
    expect(fieldNames.includes('serviceTimes')).toBe(true)
    expect(fieldNames.includes('churchLanguages')).toBe(true)
    expect(fieldNames.includes('org_node')).toBe(true)

    const galleryModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'ChurchGalleryItem')
    expect(galleryModel).toBeDefined()
    const galleryFields = (galleryModel?.fields ?? []).map((f) => f.name)
    expect(galleryFields.includes('caption')).toBe(true)
    expect(galleryFields.includes('order_index')).toBe(true)
    expect(galleryFields.includes('media_asset')).toBe(true)
  })
})
describe('LIST_PUBLIC_CHURCHES — discovery search by name or city', () => {
  it('searches by name or city (address.path) when search query is provided', async () => {
    const summaryRow = {
      id: 'c1',
      name: 'Grace',
      denomination: 'Lutheran',
      address: { line1: 'Main St', city: 'Tallinn' },
      cover_asset_id: null,
      latitude: null,
      longitude: null,
    }
    db.$transaction.mockResolvedValueOnce([1, [summaryRow]])

    const res = await LIST_PUBLIC_CHURCHES({
      query: { search: 'tal', page: 1, limit: 10 },
    })

    const expectedWhere = {
      status: 'APPROVED',
      OR: [
        { name: { contains: 'tal', mode: 'insensitive' } },
        { address: { path: ['city'], string_contains: 'tal' } },
      ],
    }

    expect(db.church.count).toHaveBeenCalledWith({ where: expectedWhere })
    expect(db.church.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        take: 10,
        skip: 0,
      }),
    )

    expect(res).toEqual({
      result: [
        {
          id: 'c1',
          name: 'Grace',
          denomination: 'Lutheran',
          city: 'Tallinn',
          coverAssetId: null,
          coverUrl: null,
          coordinates: null,
          distanceKm: null,
          latitude: null,
          longitude: null,
          addressLine1: 'Main St',
        },
      ],
      total: 1,
    })
    expect(res.result[0].latitude).toBe(summaryRow.latitude)
  })

  it('omits OR search clause when search query is not provided', async () => {
    db.$transaction.mockResolvedValueOnce([0, []])

    await LIST_PUBLIC_CHURCHES({
      query: { page: 1, limit: 10 },
    })

    const expectedWhere = { status: 'APPROVED' }
    expect(db.church.count).toHaveBeenCalledWith({ where: expectedWhere })
    expect(db.church.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
      }),
    )
  })
})

describe('isOpenNow', () => {
  it('returns true when current time is on the same weekday inside the 120-min window', () => {
    const now = new Date('2026-10-11T10:00:00Z') // UTC Sunday 10:00
    const serviceTimes = [
      { weekday: 7, local_time: new Date('1970-01-01T11:00:00Z') }, // 60 min away
    ]
    expect(isOpenNow('UTC', serviceTimes, now)).toBe(true)
  })

  it('returns true when service is exactly at the 120-min boundary (inclusive)', () => {
    const now = new Date('2026-10-11T10:00:00Z') // UTC Sunday 10:00
    const serviceTimes = [
      { weekday: 7, local_time: new Date('1970-01-01T12:00:00Z') }, // 120 min away
    ]
    expect(isOpenNow('UTC', serviceTimes, now)).toBe(true)
  })

  it('returns false when service is 121 minutes away', () => {
    const now = new Date('2026-10-11T10:00:00Z') // UTC Sunday 10:00
    const serviceTimes = [
      { weekday: 7, local_time: new Date('1970-01-01T12:01:00Z') }, // 121 min away
    ]
    expect(isOpenNow('UTC', serviceTimes, now)).toBe(false)
  })

  it('returns true for midnight wrap when service is at 23:30 and now is 00:30 on same local date', () => {
    const now = new Date('2026-10-11T00:30:00Z') // UTC Sunday 00:30
    const serviceTimes = [
      { weekday: 7, local_time: new Date('1970-01-01T23:30:00Z') }, // 60 min circular diff
    ]
    expect(isOpenNow('UTC', serviceTimes, now)).toBe(true)
  })

  it('returns false when service is on a different weekday', () => {
    const now = new Date('2026-10-11T10:00:00Z') // UTC Sunday (7)
    const serviceTimes = [
      { weekday: 1, local_time: new Date('1970-01-01T10:00:00Z') }, // Monday
    ]
    expect(isOpenNow('UTC', serviceTimes, now)).toBe(false)
  })

  it('handles church wall-clock time correctly with Europe/Tallinn vs UTC', () => {
    // 2026-10-11 is EEST (UTC+3). Instant 08:00 UTC = 11:00 Tallinn
    const now = new Date('2026-10-11T08:00:00Z')
    const serviceTimes = [
      { weekday: 7, local_time: new Date('1970-01-01T10:30:00Z') }, // 10:30 church wall clock
    ]
    // In Europe/Tallinn, local time is 11:00, diff to 10:30 is 30 min -> open
    expect(isOpenNow('Europe/Tallinn', serviceTimes, now)).toBe(true)
    // In UTC, local time is 08:00, diff to 10:30 is 150 min -> closed
    expect(isOpenNow('UTC', serviceTimes, now)).toBe(false)
  })

  it('returns false when serviceTimes array is empty', () => {
    const now = new Date('2026-10-11T10:00:00Z')
    expect(isOpenNow('UTC', [], now)).toBe(false)
  })
})

describe('LIST_PUBLIC_CHURCHES — directory filters (WB-25)', () => {
  const summaryRow = (overrides = {}) => ({
    id: 'c1',
    name: 'Grace',
    denomination: 'Lutheran',
    address: { line1: 'Main St', city: 'Tallinn' },
    cover_asset_id: null,
    latitude: null,
    longitude: null,
    ...overrides,
  })

  it('filters by denomination via case-insensitive equals (DB path)', async () => {
    db.$transaction.mockResolvedValueOnce([1, [summaryRow({ denomination: 'Lutheran' })]])

    const res = await LIST_PUBLIC_CHURCHES({
      query: { denomination: 'lutheran', page: 1, limit: 10 },
    })

    const expectedWhere = {
      status: 'APPROVED',
      denomination: { equals: 'lutheran', mode: 'insensitive' },
    }
    expect(db.church.count).toHaveBeenCalledWith({ where: expectedWhere })
    expect(db.church.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        take: 10,
        skip: 0,
      }),
    )
    expect(res.total).toBe(1)
  })

  it('filters by language via churchLanguages relation (DB path)', async () => {
    db.$transaction.mockResolvedValueOnce([1, [summaryRow()]])

    const res = await LIST_PUBLIC_CHURCHES({
      query: { language: 'et', page: 1, limit: 10 },
    })

    const expectedWhere = {
      status: 'APPROVED',
      churchLanguages: { some: { language_code: 'et' } },
    }
    expect(db.church.count).toHaveBeenCalledWith({ where: expectedWhere })
    expect(db.church.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        take: 10,
        skip: 0,
      }),
    )
    expect(res.total).toBe(1)
  })

  it('applies quick-filter flags individually when true and omits when false/absent', async () => {
    // sunday_live_stream: true
    db.$transaction.mockResolvedValueOnce([1, [summaryRow()]])
    await LIST_PUBLIC_CHURCHES({
      query: { sunday_live_stream: true, page: 1, limit: 10 },
    })
    expect(db.church.count).toHaveBeenLastCalledWith({
      where: { status: 'APPROVED', sunday_live_stream: true },
    })

    // taize_chants: true
    db.$transaction.mockResolvedValueOnce([1, [summaryRow()]])
    await LIST_PUBLIC_CHURCHES({
      query: { taize_chants: true, page: 1, limit: 10 },
    })
    expect(db.church.count).toHaveBeenLastCalledWith({
      where: { status: 'APPROVED', taize_chants: true },
    })

    // youth_ministry: true
    db.$transaction.mockResolvedValueOnce([1, [summaryRow()]])
    await LIST_PUBLIC_CHURCHES({
      query: { youth_ministry: true, page: 1, limit: 10 },
    })
    expect(db.church.count).toHaveBeenLastCalledWith({
      where: { status: 'APPROVED', youth_ministry: true },
    })

    // sunday_live_stream: false -> omitted from where clause
    db.$transaction.mockResolvedValueOnce([1, [summaryRow()]])
    await LIST_PUBLIC_CHURCHES({
      query: { sunday_live_stream: false, page: 1, limit: 10 },
    })
    expect(db.church.count).toHaveBeenLastCalledWith({
      where: { status: 'APPROVED' },
    })
  })

  it('filters by radius in-memory, excluding churches outside radius and with null coordinates', async () => {
    // Tallinn center: 59.437, 24.754
    // Row A: within radius (Tallinn: dist 0 km)
    const rowA = summaryRow({
      id: 'c1',
      name: 'Tallinn Church',
      latitude: 59.437,
      longitude: 24.754,
    })
    // Row B: outside radius (Tartu ~163 km away)
    const rowB = summaryRow({ id: 'c2', name: 'Tartu Church', latitude: 58.378, longitude: 26.729 })
    // Row C: null coordinates
    const rowC = summaryRow({ id: 'c3', name: 'No Coords Church', latitude: null, longitude: null })

    db.church.findMany.mockResolvedValueOnce([rowA, rowB, rowC])

    const res = await LIST_PUBLIC_CHURCHES({
      query: { latitude: 59.437, longitude: 24.754, radius_km: 10, page: 1, limit: 10 },
    })

    const expectedWhere = { status: 'APPROVED' }
    expect(db.church.count).not.toHaveBeenCalled()
    expect(db.church.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: expect.any(Object),
    })
    const callArgs = db.church.findMany.mock.calls[0][0]
    expect(callArgs.take).toBeUndefined()
    expect(callArgs.skip).toBeUndefined()

    expect(res.total).toBe(1)
    expect(res.result).toHaveLength(1)
    expect(res.result[0].id).toBe('c1')
    expect(res.result[0].latitude).toBe(59.437)
    expect(res.result[0].longitude).toBe(24.754)
  })

  it('sorts churches by distance ascending when coordinates are provided (null coords last)', async () => {
    // Query coords: Tallinn 59.437, 24.754
    const farRow = summaryRow({
      id: 'c-far',
      name: 'Tartu Church',
      latitude: 58.378,
      longitude: 26.729,
    })
    const nearRow = summaryRow({
      id: 'c-near',
      name: 'Tallinn Church',
      latitude: 59.437,
      longitude: 24.754,
    })
    const nullRow = summaryRow({
      id: 'c-null',
      name: 'Online Church',
      latitude: null,
      longitude: null,
    })

    db.church.findMany.mockResolvedValueOnce([farRow, nearRow, nullRow])

    const res = await LIST_PUBLIC_CHURCHES({
      query: { latitude: 59.437, longitude: 24.754, page: 1, limit: 10 },
    })

    expect(res.total).toBe(3)
    expect(res.result.map((r) => r.id)).toEqual(['c-near', 'c-far', 'c-null'])
    expect(res.result[0].distanceKm).toBe(0)
    expect(res.result[1].distanceKm).toBeGreaterThan(100)
    expect(res.result[2].distanceKm).toBeNull()
  })

  it('filters by open_now in-memory using church wall-clock and serviceTimes ±2h window', async () => {
    try {
      vi.useFakeTimers()
      // Sunday 11:00 in Europe/Tallinn (UTC+3) -> instant is 08:00 UTC
      vi.setSystemTime(new Date('2026-10-11T08:00:00Z'))

      // Row 1: Sunday service at 10:00 wall clock -> open now (1h diff <= 2h)
      const rowInside = summaryRow({
        id: 'c-open',
        timezone: 'Europe/Tallinn',
        serviceTimes: [
          { weekday: 7, local_time: new Date('1970-01-01T10:00:00Z'), label: 'Sunday Service' },
        ],
      })
      // Row 2: No service times -> closed
      const rowNoServices = summaryRow({
        id: 'c-empty',
        timezone: 'Europe/Tallinn',
        serviceTimes: [],
      })
      // Row 3: Sunday service at 15:00 wall clock -> closed (4h diff > 2h)
      const rowOutside = summaryRow({
        id: 'c-closed',
        timezone: 'Europe/Tallinn',
        serviceTimes: [
          { weekday: 7, local_time: new Date('1970-01-01T15:00:00Z'), label: 'Evening Service' },
        ],
      })

      db.church.findMany.mockResolvedValueOnce([rowInside, rowNoServices, rowOutside])

      const res = await LIST_PUBLIC_CHURCHES({
        query: { open_now: true, page: 1, limit: 10 },
      })

      expect(db.church.count).not.toHaveBeenCalled()
      expect(res.total).toBe(1)
      expect(res.result).toHaveLength(1)
      expect(res.result[0].id).toBe('c-open')
    } finally {
      vi.useRealTimers()
    }
  })

  it('combines search, denomination, language, quick filters, and in-memory radius', async () => {
    const insideRow = summaryRow({
      id: 'c-match',
      name: 'Grace Cathedral',
      denomination: 'Lutheran',
      latitude: 59.437,
      longitude: 24.754,
    })
    const outsideRow = summaryRow({
      id: 'c-outside',
      name: 'Grace Chapel',
      denomination: 'Lutheran',
      latitude: 58.378,
      longitude: 26.729,
    })

    db.church.findMany.mockResolvedValueOnce([insideRow, outsideRow])

    const res = await LIST_PUBLIC_CHURCHES({
      query: {
        search: 'grace',
        denomination: 'Lutheran',
        language: 'et',
        sunday_live_stream: true,
        latitude: 59.437,
        longitude: 24.754,
        radius_km: 10,
        page: 1,
        limit: 10,
      },
    })

    const expectedWhere = {
      status: 'APPROVED',
      OR: [
        { name: { contains: 'grace', mode: 'insensitive' } },
        { address: { path: ['city'], string_contains: 'grace' } },
      ],
      denomination: { equals: 'Lutheran', mode: 'insensitive' },
      churchLanguages: { some: { language_code: 'et' } },
      sunday_live_stream: true,
    }

    expect(db.church.count).not.toHaveBeenCalled()
    expect(db.church.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
      }),
    )
    expect(res.total).toBe(1)
    expect(res.result).toHaveLength(1)
    expect(res.result[0].id).toBe('c-match')
  })

  it('returns empty result when filters match no churches (DB path)', async () => {
    db.$transaction.mockResolvedValueOnce([0, []])

    const res = await LIST_PUBLIC_CHURCHES({
      query: { denomination: 'NonExistent', language: 'xx', page: 1, limit: 10 },
    })

    const expectedWhere = {
      status: 'APPROVED',
      denomination: { equals: 'NonExistent', mode: 'insensitive' },
      churchLanguages: { some: { language_code: 'xx' } },
    }
    expect(db.church.count).toHaveBeenCalledWith({ where: expectedWhere })
    expect(res.total).toBe(0)
    expect(res.result).toEqual([])
  })

  it('returns accessibility as an array of items split by delimiter instead of joined string', async () => {
    const row = summaryRow({
      accessibility: 'Level wheelchair access • Hearing loop • Braille hymnals',
    })
    db.$transaction.mockResolvedValueOnce([1, [row]])

    const res = await LIST_PUBLIC_CHURCHES({
      query: { page: 1, limit: 10 },
    })

    expect(res.result[0].accessibility).toEqual([
      'Level wheelchair access',
      'Hearing loop',
      'Braille hymnals',
    ])
  })
})

describe('mapPublishedPrayer (via GET_PUBLISHED_PRAYER)', () => {
  it('returns audio: null when audio snapshot is READY but not APPROVED', async () => {
    db.prayer.findFirst.mockResolvedValueOnce({
      id: 'p1',
      church_id: 'c1',
      published_at: new Date(),
      published_version_id: 'v1',
    })
    db.prayerVersion.findFirst.mockResolvedValueOnce({
      id: 'v1',
      title: 'Prayer',
      body: 'Amen',
      language_code: 'en',
      selected_audio: {
        id: 'a1',
        status: 'READY',
        asset: { id: 'asset1', object_key: 'media/asset1' },
      },
      pastor: {
        id: 'pa1',
        display_name: 'Pastor',
      },
    })

    const result = await GET_PUBLISHED_PRAYER({ prayerId: 'p1' })
    expect(result).not.toBeNull()
    expect(result?.audio).toBeNull()
  })

  it('returns audio: null when audio snapshot is APPROVED but lacks asset_id', async () => {
    db.prayer.findFirst.mockResolvedValueOnce({
      id: 'p1',
      church_id: 'c1',
      published_at: new Date(),
      published_version_id: 'v1',
    })
    db.prayerVersion.findFirst.mockResolvedValueOnce({
      id: 'v1',
      title: 'Prayer',
      body: 'Amen',
      language_code: 'en',
      selected_audio: {
        id: 'a1',
        status: 'APPROVED',
        asset: null,
      },
      pastor: {
        id: 'pa1',
        display_name: 'Pastor',
      },
    })

    const result = await GET_PUBLISHED_PRAYER({ prayerId: 'p1' })
    expect(result).not.toBeNull()
    expect(result?.audio).toBeNull()
  })

  it('returns audio details when audio snapshot is APPROVED and has asset_id', async () => {
    db.prayer.findFirst.mockResolvedValueOnce({
      id: 'p1',
      church_id: 'c1',
      published_at: new Date(),
      published_version_id: 'v1',
    })
    db.prayerVersion.findFirst.mockResolvedValueOnce({
      id: 'v1',
      title: 'Prayer',
      body: 'Amen',
      language_code: 'en',
      selected_audio: {
        id: 'a1',
        status: 'APPROVED',
        asset: { id: 'asset1', object_key: 'media/asset1' },
        approved_at: new Date('2026-01-01T00:00:00Z'),
      },
      pastor: {
        id: 'pa1',
        display_name: 'Pastor',
      },
    })

    const result = await GET_PUBLISHED_PRAYER({ prayerId: 'p1' })
    expect(result).not.toBeNull()
    expect(result?.audio).toEqual({
      prayerAudioId: 'a1',
      assetId: 'asset1',
      assetKey: 'media/asset1',
      approvedAt: '2026-01-01T00:00:00.000Z',
    })
  })
})

describe('LIST_PUBLISHED_PRAYERS — historical pastor attribution', () => {
  it('returns the pastor stored on the immutable published version', async () => {
    const publishedRows = [
      {
        id: 'prayer-1',
        church_id: 'church-1',
        published_at: new Date('2026-09-30T12:00:00.000Z'),
        published_version_id: 'version-1',
      },
    ]
    db.$transaction.mockResolvedValue([1, publishedRows])
    db.prayerVersion.findMany.mockResolvedValue([
      {
        id: 'version-1',
        version_number: 2,
        pastor_id: 'pastor-at-publication',
        title: 'Morning prayer',
        introduction: null,
        body: 'Prayer body',
        language_code: 'en',
        selected_audio: null,
      },
    ])

    const result = await LIST_PUBLISHED_PRAYERS({
      churchId: 'church-1',
      query: { page: 1, limit: 25 },
    })

    expect(result.result[0].version.pastorId).toBe('pastor-at-publication')
    expect(db.prayerVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['version-1'] } } }),
    )
  })
})

describe('LIST_PUBLIC_EVENTS — admin event edits reflected under the correct church', () => {
  it('filters by the exact church and maps the admin-edited fields', async () => {
    db.$transaction.mockImplementationOnce((ops: Promise<unknown>[]) => Promise.all(ops))
    db.event.count.mockResolvedValueOnce(1)
    db.event.findMany.mockResolvedValueOnce([
      {
        id: 'e1',
        church_id: 'church-1',
        category: 'BIBLE_STUDY',
        title: 'Edited title',
        description: 'Edited description',
        starts_at: new Date('2026-12-01T08:00:00Z'),
        location: 'Room 9',
        registration_url: 'https://example.org/r',
        language_code: 'et',
        cta_label: 'Custom CTA',
      },
    ])

    const result = await LIST_PUBLIC_EVENTS({
      churchId: 'church-1',
      query: { page: 1, limit: 10 } as never,
    })

    const where = db.event.findMany.mock.calls[0][0].where
    expect(where.church_id).toBe('church-1')
    expect(where.church).toEqual({ status: 'APPROVED' })
    expect(result.result).toEqual([
      {
        id: 'e1',
        churchId: 'church-1',
        category: 'bible_study',
        title: 'Edited title',
        description: 'Edited description',
        startsAt: '2026-12-01T08:00:00.000Z',
        location: 'Room 9',
        registrationUrl: 'https://example.org/r',
        languageCode: 'et',
        ctaLabel: 'Custom CTA',
      },
    ])
  })
})

describe('LIST_PUBLIC_ANNOUNCEMENTS — only live published rows', () => {
  it('excludes drafts and soft-deleted announcements for count and rows', async () => {
    db.$transaction.mockImplementationOnce((ops: Promise<unknown>[]) => Promise.all(ops))
    db.announcement.count.mockResolvedValueOnce(0)
    db.announcement.findMany.mockResolvedValueOnce([])

    await LIST_PUBLIC_ANNOUNCEMENTS({
      churchId: 'church-1',
      query: { page: 1, limit: 10 } as never,
    })

    const where = {
      church_id: 'church-1',
      church: { status: 'APPROVED' },
      published_at: { not: null },
      deleted_at: null,
    }
    expect(db.announcement.count).toHaveBeenCalledWith({ where })
    expect(db.announcement.findMany.mock.calls[0][0].where).toEqual(where)
  })
})

describe('COUNT_RECENT_USER_REQUESTS — submission rate limit window', () => {
  it("counts only this user's requests at this church since the window start", async () => {
    db.request.count.mockResolvedValue(3)
    const since = new Date('2026-01-01T00:00:00Z')
    await expect(
      COUNT_RECENT_USER_REQUESTS({ churchId: 'c1', userId: 'u1', since, tx: null }),
    ).resolves.toBe(3)
    expect(db.request.count).toHaveBeenCalledWith({
      where: { church_id: 'c1', user_id: 'u1', created_at: { gte: since } },
    })
  })
})

describe('GET_USER_REQUEST_ACK — idempotent replay', () => {
  it("returns the caller's own request as a minimal lowercase ack", async () => {
    const created_at = new Date('2026-01-01T00:00:00Z')
    db.request.findFirst.mockResolvedValue({ id: 'r1', kind: 'MEETING', created_at })
    await expect(GET_USER_REQUEST_ACK({ id: 'r1', userId: 'u1' })).resolves.toEqual({
      id: 'r1',
      kind: 'meeting',
      createdAt: created_at.toISOString(),
    })
    expect(db.request.findFirst).toHaveBeenCalledWith({
      where: { id: 'r1', user_id: 'u1' },
      select: { id: true, kind: true, created_at: true },
    })
  })

  it('returns null for a request the caller does not own', async () => {
    db.request.findFirst.mockResolvedValue(null)
    await expect(GET_USER_REQUEST_ACK({ id: 'r1', userId: 'u2' })).resolves.toBeNull()
  })
})

describe('CREATE_USER_REQUEST — no sensitive payload outside the row', () => {
  it('stores the request and writes an audit row without message/contact/classification', async () => {
    const created_at = new Date('2026-01-01T00:00:00Z')
    const tx = {
      request: { create: vi.fn().mockResolvedValue({ id: 'r1', created_at }) },
      auditLog: { create: vi.fn() },
    }
    const ack = await CREATE_USER_REQUEST({
      churchId: 'c1',
      userId: 'u1',
      data: {
        kind: 'prayer',
        subject: 'S',
        message: 'secret message',
        classification: 'PRIVATE',
        contactMethod: 'email',
        email: 'me@example.com',
        phone: '+3725550000',
      },
      requestId: 't1',
      tx: tx as never,
    })
    expect(ack).toEqual({ id: 'r1', kind: 'prayer', createdAt: created_at.toISOString() })
    expect(tx.request.create.mock.calls[0][0].data).toMatchObject({
      church_id: 'c1',
      user_id: 'u1',
      kind: 'PRAYER',
    })
    const audit = JSON.stringify(tx.auditLog.create.mock.calls[0][0])
    for (const leaked of ['secret message', 'me@example.com', '+3725550000', 'PRIVATE']) {
      expect(audit).not.toContain(leaked)
    }
  })
})

describe('church cover URLs (MB-17)', () => {
  const myChurchRow = (over: Record<string, unknown> = {}) => ({
    is_main: true,
    is_followed: true,
    church: {
      id: 'c1',
      name: 'Grace',
      address: { city: 'Tallinn' },
      cover_asset_id: 'm1',
      status: 'APPROVED',
    },
    ...over,
  })

  it('LIST_MY_CHURCHES adds coverUrl for a READY IMAGE asset', async () => {
    db.userChurch.findMany.mockResolvedValueOnce([myChurchRow()])
    db.mediaAsset.findFirst.mockResolvedValueOnce({ object_key: 'media/c1/image/abc' })

    const res = await LIST_MY_CHURCHES({ userId: 'u1' })

    expect(res[0].coverAssetId).toBe('m1')
    expect(res[0].coverUrl).toBe('https://cdn.test/media/c1/image/abc')
    expect(db.mediaAsset.findFirst).toHaveBeenCalledWith({
      where: { id: 'm1', status: 'READY', purpose: 'IMAGE' },
      select: { object_key: true },
    })
  })

  it('coverUrl is null when the church has no cover_asset_id', async () => {
    db.userChurch.findMany.mockResolvedValueOnce([
      myChurchRow({
        church: {
          id: 'c1',
          name: 'Grace',
          address: null,
          cover_asset_id: null,
          status: 'APPROVED',
        },
      }),
    ])

    const res = await LIST_MY_CHURCHES({ userId: 'u1' })

    expect(res[0].coverUrl).toBeNull()
    expect(db.mediaAsset.findFirst).not.toHaveBeenCalled()
  })

  it('coverUrl is null when the asset is not READY (findFirst -> null)', async () => {
    db.userChurch.findMany.mockResolvedValueOnce([myChurchRow()])
    db.mediaAsset.findFirst.mockResolvedValueOnce(null)

    const res = await LIST_MY_CHURCHES({ userId: 'u1' })
    expect(res[0].coverUrl).toBeNull()
  })

  it('coverUrl is null (no throw, no 500) when storage is not configured', async () => {
    db.userChurch.findMany.mockResolvedValueOnce([myChurchRow()])
    db.mediaAsset.findFirst.mockResolvedValueOnce({ object_key: 'media/c1/image/abc' })
    s3.S3_PUBLIC_URL.mockReturnValueOnce(null)

    const res = await LIST_MY_CHURCHES({ userId: 'u1' })
    expect(res[0].coverUrl).toBeNull()
  })

  it('GET_PUBLIC_CHURCH exposes coverAssetId + coverUrl on the public profile', async () => {
    db.church.findFirst.mockResolvedValueOnce({
      id: 'c1',
      name: 'Grace',
      timezone: 'UTC',
      cover_asset_id: 'm1',
      churchLanguages: [],
      serviceTimes: [],
    })
    db.mediaAsset.findFirst.mockResolvedValueOnce({ object_key: 'media/c1/image/abc' })

    const res = await GET_PUBLIC_CHURCH({ churchId: 'c1' })

    expect(res?.coverAssetId).toBe('m1')
    expect(res?.coverUrl).toBe('https://cdn.test/media/c1/image/abc')
  })
})

describe('GET_HOME — MB-10 typed projection', () => {
  it('returns mainChurch/followedChurches and typed latest* arrays (no main/followed)', async () => {
    db.userChurch.findMany.mockResolvedValueOnce([
      { is_main: true, is_followed: false, church_id: 'c1' },
      { is_main: false, is_followed: true, church_id: 'c2' },
    ])
    db.church.findFirst.mockResolvedValueOnce({
      id: 'c1',
      name: 'Main',
      timezone: 'UTC',
      churchLanguages: [],
      serviceTimes: [],
      cover_asset_id: null,
    })
    db.$transaction.mockImplementation(async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : arg,
    )
    db.prayer.count.mockResolvedValueOnce(1)
    db.prayer.findMany.mockResolvedValueOnce([
      { id: 'p1', church_id: 'c1', published_at: new Date(), published_version_id: 'v1' },
    ])
    db.prayerVersion.findMany.mockResolvedValueOnce([
      {
        id: 'v1',
        title: 'Prayer',
        body: 'Amen',
        language_code: 'en',
        selected_audio: null,
        pastor: { id: 'pa1', display_name: 'Pastor' },
      },
    ])
    db.event.count.mockResolvedValueOnce(0)
    db.event.findMany.mockResolvedValueOnce([])
    db.announcement.count.mockResolvedValueOnce(0)
    db.announcement.findMany.mockResolvedValueOnce([])
    db.church.findMany.mockResolvedValueOnce([
      {
        id: 'c2',
        name: 'Two',
        denomination: null,
        address: null,
        cover_asset_id: null,
        latitude: null,
        longitude: null,
      },
    ])

    const res = await GET_HOME({ userId: 'u1' })

    expect(Object.keys(res).sort()).toEqual([
      'followedChurches',
      'latestAnnouncements',
      'latestEvents',
      'latestPrayers',
      'mainChurch',
    ])
    expect(res).not.toHaveProperty('main')
    expect(res).not.toHaveProperty('followed')
    expect(res.mainChurch?.id).toBe('c1')
    expect(res.followedChurches[0].id).toBe('c2')
    expect(res.latestPrayers[0].version.title).toBe('Prayer')
    expect(res.latestEvents).toEqual([])
    expect(res.latestAnnouncements).toEqual([])
  })
})

describe('MB-11 — church summary coordinates', () => {
  const summaryRow = (over: Record<string, unknown> = {}) => ({
    id: 'c1',
    name: 'Grace',
    denomination: null,
    address: { city: 'Tallinn' },
    cover_asset_id: null,
    latitude: 59.437,
    longitude: 24.7536,
    ...over,
  })

  const mockList = (rows: unknown[]) => {
    db.$transaction.mockImplementationOnce(async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : arg,
    )
    db.church.count.mockResolvedValueOnce(rows.length)
    db.church.findMany.mockResolvedValueOnce(rows)
  }

  it('serves coordinates when the church has a lat/lng pair', async () => {
    mockList([summaryRow()])

    const { result } = await LIST_PUBLIC_CHURCHES({ query: { page: 1, limit: 25 } })

    expect(result[0].coordinates).toEqual({ latitude: 59.437, longitude: 24.7536 })
  })

  it('serves coordinates: null when the church has none (both-or-neither rule)', async () => {
    mockList([
      summaryRow({ id: 'coords', latitude: 59.437, longitude: 24.7536 }),
      summaryRow({ id: 'no-coords', latitude: null, longitude: null }),
    ])

    const { result } = await LIST_PUBLIC_CHURCHES({ query: { page: 1, limit: 25 } })

    // the key is always present; the value is the honest state
    expect(result.every((c) => 'coordinates' in c)).toBe(true)
    expect(result.find((c) => c.id === 'no-coords')?.coordinates).toBeNull()
    expect(result.find((c) => c.id === 'coords')?.coordinates).toEqual({
      latitude: 59.437,
      longitude: 24.7536,
    })
  })

  it('home followed churches carry the same coordinates field', async () => {
    db.userChurch.findMany.mockResolvedValueOnce([
      { is_main: false, is_followed: true, church_id: 'c2' },
    ])
    // followed-only fixture: GET_HOME's main row falls back to approved[0]
    db.church.findFirst.mockResolvedValueOnce(null)
    db.church.findMany.mockResolvedValueOnce([
      {
        id: 'c2',
        name: 'Two',
        denomination: null,
        address: null,
        cover_asset_id: null,
        latitude: 58.3776,
        longitude: 26.729,
      },
    ])

    const home = await GET_HOME({ userId: 'u1' })

    expect(home.followedChurches.every((c) => 'coordinates' in c)).toBe(true)
    expect(home.followedChurches[0].coordinates).toEqual({
      latitude: 58.3776,
      longitude: 26.729,
    })
  })
})
