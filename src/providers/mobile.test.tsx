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
  CREATE_CHECKIN,
  UPDATE_ME_PROFILE,
  GET_HOME,
  GET_PUBLIC_CHURCH,
  GET_PUBLISHED_PRAYER,
  LIST_MY_CHURCHES,
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
