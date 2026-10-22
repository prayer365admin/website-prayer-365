import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  userChurch: { findMany: vi.fn() },
  church: { findFirst: vi.fn(), findUnique: vi.fn() },
  prayer: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  prayerVersion: { findMany: vi.fn() },
  churchPastor: { findMany: vi.fn() },
}))
const s3 = vi.hoisted(() => ({ S3_PUBLIC_URL: vi.fn() }))

vi.mock('@/utils/db-connection', () => ({ db }))
vi.mock('@/providers/s3', () => ({ S3_PUBLIC_URL: s3.S3_PUBLIC_URL }))

import {
  COUNT_SITE_PRAYERS,
  GET_LATEST_PLAYABLE_SITE_PRAYER,
  GET_SITE_PRAYER_ARCHIVE,
  GET_SITE_PRAYER_DETAIL,
} from './site-prayer'

const query = {
  page: 1,
  limit: 1,
  search: '',
  churchId: '',
  language: '',
  format: 'all' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  s3.S3_PUBLIC_URL.mockImplementation(({ key }: { key: string }) => `https://cdn.test/${key}`)
  db.userChurch.findMany.mockResolvedValue([
    { church_id: 'c1', church: { name: 'Hope Church' } },
    { church_id: 'c2', church: { name: 'Grace Church' } },
  ])
  db.prayer.findMany.mockResolvedValue([
    {
      id: 'p1',
      church_id: 'c1',
      church: { name: 'Hope Church' },
      published_at: new Date('2026-10-15T08:00:00Z'),
      published_version_id: 'v1',
    },
    {
      id: 'p2',
      church_id: 'c2',
      church: { name: 'Grace Church' },
      published_at: new Date('2026-10-14T08:00:00Z'),
      published_version_id: 'v2',
    },
    {
      id: 'p3',
      church_id: 'c1',
      church: { name: 'Hope Church' },
      published_at: new Date('2026-10-13T08:00:00Z'),
      published_version_id: 'v3',
    },
  ])
  db.prayerVersion.findMany.mockResolvedValue([
    {
      id: 'v1',
      pastor_id: 'pastor-1',
      title: 'Peace in uncertainty',
      introduction: 'A quiet meditation',
      body: '[calm] Be still [pause] and know.',
      language_code: 'en',
      pastor: { name: 'Daniel', image_asset: { object_key: 'pastor.jpg' } },
      selected_audio: {
        id: 'a1',
        status: 'APPROVED',
        approved_at: new Date('2026-10-15T07:00:00Z'),
        asset: { object_key: 'audio.mp3' },
      },
    },
    {
      id: 'v2',
      pastor_id: 'pastor-2',
      title: 'Morning gratitude',
      introduction: 'Begin in gratitude',
      body: 'Give thanks today.',
      language_code: 'et',
      pastor: { name: 'Eva', image_asset: null },
      selected_audio: null,
    },
    {
      id: 'v3',
      pastor_id: 'pastor-1',
      title: 'Evening peace',
      introduction: null,
      body: 'Rest in grace.',
      language_code: 'en',
      pastor: { name: 'Daniel', image_asset: null },
      selected_audio: null,
    },
  ])
  db.churchPastor.findMany.mockResolvedValue([
    {
      church_id: 'c1',
      pastor_id: 'pastor-1',
      pastoral_role: 'Pastor',
      image_asset: null,
    },
  ])
})

describe('GET_SITE_PRAYER_ARCHIVE', () => {
  it('selects the newest approved-audio prayer as featured and paginates the remaining grid', async () => {
    const archive = await GET_SITE_PRAYER_ARCHIVE({ userId: 'u1', query })

    expect(archive.featured?.id).toBe('p1')
    expect(archive.featured?.audio?.url).toBe('https://cdn.test/audio.mp3')
    expect(archive.result.map((item) => item.id)).toEqual(['p2'])
    expect(archive.total).toBe(2)
    expect(archive.totalPages).toBe(2)
    expect(archive.languages).toEqual(['en', 'et'])
  })

  it('removes ElevenLabs audio tags from the text readers see and search', async () => {
    const archive = await GET_SITE_PRAYER_ARCHIVE({ userId: 'u1', query })
    expect(archive.featured?.body).toBe('Be still and know.')

    const tagSearch = await GET_SITE_PRAYER_ARCHIVE({
      userId: 'u1',
      query: { ...query, search: 'calm' },
    })
    expect(tagSearch.featured).toBeNull()
    expect(tagSearch.total).toBe(0)
  })

  it('combines search, language, and text-only filters before pagination', async () => {
    const archive = await GET_SITE_PRAYER_ARCHIVE({
      userId: 'u1',
      query: { ...query, limit: 6, search: 'daniel', language: 'en', format: 'text' },
    })

    expect(archive.featured).toBeNull()
    expect(archive.result.map((item) => item.id)).toEqual(['p3'])
    expect(archive.total).toBe(1)
  })

  it('rejects a query-string church outside the customer fellowship', async () => {
    const archive = await GET_SITE_PRAYER_ARCHIVE({
      userId: 'u1',
      query: { ...query, churchId: 'not-followed' },
    })

    expect(archive.result).toEqual([])
    expect(db.prayer.findMany).not.toHaveBeenCalled()
  })

  it('allows the fixed church archive for any approved church', async () => {
    db.church.findFirst.mockResolvedValue({ id: 'c3', name: 'Open Parish' })
    db.prayer.findMany.mockResolvedValue([])
    db.prayerVersion.findMany.mockResolvedValue([])
    db.churchPastor.findMany.mockResolvedValue([])

    const archive = await GET_SITE_PRAYER_ARCHIVE({
      userId: 'u1',
      query,
      fixedChurchId: 'c3',
    })

    expect(archive.churches).toEqual([{ value: 'c3', label: 'Open Parish' }])
    expect(db.prayer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ church_id: { in: ['c3'] } }) }),
    )
  })
})

describe('GET_LATEST_PLAYABLE_SITE_PRAYER', () => {
  it('returns the newest published prayer that has approved audio', async () => {
    await expect(GET_LATEST_PLAYABLE_SITE_PRAYER()).resolves.toEqual({
      id: 'p1',
      title: 'Peace in uncertainty',
      churchName: 'Hope Church',
      pastorName: 'Daniel',
      languageCode: 'en',
      audioUrl: 'https://cdn.test/audio.mp3',
    })
    expect(db.prayer.findMany).toHaveBeenCalledWith({
      where: {
        church: { status: 'APPROVED' },
        published_version_id: { not: null },
        published_at: { not: null },
      },
      orderBy: [{ published_at: 'desc' }, { id: 'desc' }],
      select: expect.any(Object),
    })
  })

  it('returns null when no published prayer has playable audio', async () => {
    db.prayerVersion.findMany.mockResolvedValue([])

    await expect(GET_LATEST_PLAYABLE_SITE_PRAYER()).resolves.toBeNull()
  })
})

describe('GET_SITE_PRAYER_DETAIL', () => {
  it('returns only a published prayer of an approved church, with church and siblings', async () => {
    db.prayer.findFirst.mockResolvedValue({
      id: 'p1',
      church_id: 'c1',
      church: { name: 'Hope Church' },
      published_at: new Date('2026-10-15T08:00:00Z'),
      published_version_id: 'v1',
    })
    db.church.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Hope Church',
      address: { city: 'Tallinn' },
    })
    db.prayer.findMany.mockResolvedValue([])

    const detail = await GET_SITE_PRAYER_DETAIL({ prayerId: 'p1' })

    expect(db.prayer.findFirst.mock.calls[0][0].where).toEqual({
      id: 'p1',
      church: { status: 'APPROVED' },
      published_version_id: { not: null },
      published_at: { not: null },
    })
    expect(db.prayer.findMany.mock.calls[0][0].where).toMatchObject({
      church_id: 'c1',
      id: { not: 'p1' },
    })
    expect(detail?.prayer.body).toBe('Be still and know.')
    expect(detail?.prayer.audio?.url).toBe('https://cdn.test/audio.mp3')
    expect(detail?.church).toEqual({
      id: 'c1',
      name: 'Hope Church',
      city: 'Tallinn',
    })
  })

  it('returns null for a missing, draft, or unapproved-church prayer', async () => {
    db.prayer.findFirst.mockResolvedValue(null)
    expect(await GET_SITE_PRAYER_DETAIL({ prayerId: 'nope' })).toBeNull()
  })
})

describe('COUNT_SITE_PRAYERS', () => {
  it("counts published prayers of the user's approved main/followed churches", async () => {
    db.prayer.count.mockResolvedValue(4)

    await expect(COUNT_SITE_PRAYERS({ userId: 'u1' })).resolves.toBe(4)
    expect(db.prayer.count).toHaveBeenCalledWith({
      where: {
        church: {
          status: 'APPROVED',
          userChurches: { some: { user_id: 'u1', OR: [{ is_main: true }, { is_followed: true }] } },
        },
        published_version_id: { not: null },
        published_at: { not: null },
      },
    })
  })
})
