import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  analyticsEvent: { createMany: vi.fn() },
  auditLog: { create: vi.fn() },
}))

vi.mock('@/utils/db-connection', () => ({ db }))

import {
  churchLocalDate,
  CREATE_CHECKIN,
  UPDATE_ME_PROFILE,
  GET_PUBLIC_CHURCH,
  GET_PUBLISHED_PRAYER,
  LIST_PUBLIC_ANNOUNCEMENTS,
  LIST_PUBLIC_EVENTS,
  LIST_PUBLISHED_PRAYERS,
} from './mobile'

beforeEach(() => vi.clearAllMocks())

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
    user: { update: vi.fn() },
    church: { findFirst: vi.fn() },
    userChurch: { updateMany: vi.fn(), upsert: vi.fn() },
  }

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
    expect(result?.serviceTimes[0].localTime).toBe('1970-01-01T09:00:00.000Z')
    expect(result?.serviceTimes[0].languageCode).toBe('et')
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
