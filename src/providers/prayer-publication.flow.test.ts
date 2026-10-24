import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * WB-35 publication flow: the real website read paths — Home feed (GET_HOME),
 * prayer archive, church archive and prayer detail — run against one small
 * in-memory stand-in for Prisma. The seed mixes every case that must stay
 * hidden (draft, scheduled-but-unpublished, suspended church) with the audio
 * states that must not become playable (unapproved, approved without a file).
 * Hidden rows are seeded NEWEST so a broken gate would surface them first.
 * Only the database is faked; S3_PUBLIC_URL is the real implementation.
 */

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const store = vi.hoisted(() => ({
  church: [] as Row[],
  userChurch: [] as Row[],
  prayer: [] as Row[],
  prayerVersion: [] as Row[],
}))

const fake = vi.hoisted(() => {
  // Prisma-like where: equality, null, OR, { in }, { not }, and nested relation objects.
  const matches = (row: Row | null | undefined, where: Row = {}): boolean =>
    !!row &&
    Object.entries(where).every(([k, v]) => {
      if (k === 'OR') return (v as Row[]).some((w) => matches(row, w))
      if (v === undefined) return true
      if (v === null) return row[k] == null
      if (v instanceof Date) return row[k]?.getTime() === v.getTime()
      if (typeof v === 'object') {
        if ('in' in v) return (v.in as unknown[]).includes(row[k])
        if ('not' in v) return v.not === null ? row[k] != null : row[k] !== v.not
        return matches(row[k], v) // relation filter, e.g. church: { status }
      }
      return row[k] === v
    })
  const sortBy = (rows: Row[], orderBy?: Row | Row[]) => {
    const keys = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []).flatMap((o) =>
      Object.entries(o).filter(([, dir]) => typeof dir === 'string'),
    )
    return [...rows].sort((a, b) => {
      for (const [key, dir] of keys) {
        // Postgres default: NULL sorts as the largest value (first in DESC, last in ASC).
        const value = (v: unknown) => (v == null ? Infinity : v instanceof Date ? v.getTime() : v)
        const x = value(a[key])
        const y = value(b[key])
        if (x !== y) return (x > y ? 1 : -1) * (dir === 'desc' ? -1 : 1)
      }
      return 0
    })
  }
  const table = (rows: () => Row[]) => ({
    findMany: async ({ where, orderBy, take }: Row = {}) =>
      sortBy(
        rows().filter((r) => matches(r, where)),
        orderBy,
      ).slice(0, take ?? undefined),
    findFirst: async ({ where, orderBy }: Row = {}) =>
      sortBy(
        rows().filter((r) => matches(r, where)),
        orderBy,
      )[0] ?? null,
    findUnique: async ({ where }: Row) => rows().find((r) => matches(r, where)) ?? null,
  })
  return { table }
})

vi.mock('@/utils/db-connection', () => ({
  db: {
    church: fake.table(() => store.church),
    userChurch: fake.table(() => store.userChurch),
    prayer: fake.table(() => store.prayer),
    prayerVersion: fake.table(() => store.prayerVersion),
    churchPastor: { findMany: async () => [] },
    mediaAsset: { findFirst: async () => null },
  },
}))

import { GET_HOME } from './mobile'
import { GET_SITE_PRAYER_ARCHIVE, GET_SITE_PRAYER_DETAIL } from './site-prayer'

const CDN = 'https://cdn.test'
const query = {
  page: 1,
  limit: 24,
  search: '',
  churchId: '',
  language: '',
  duration: 'all' as const,
  format: 'all' as const,
}

const church = (id: string, status: string) => ({
  id,
  name: `Church ${id}`,
  status,
  address: { city: 'Tallinn' },
  denomination: null,
  cover_asset_id: null,
  latitude: null,
  longitude: null,
})

const audio = (status: string, objectKey: string | null) => ({
  id: `audio-${objectKey ?? status}`,
  status,
  approved_at: status === 'APPROVED' ? new Date('2026-10-01T00:00:00Z') : null,
  approved_by: null,
  asset: objectKey ? { id: `asset-${objectKey}`, object_key: objectKey } : null,
})

/** One prayer + its version. `published: false` keeps the version unpublished (draft). */
const seedPrayer = ({
  id,
  churchId,
  day,
  published = true,
  publishedAt = true,
  selectedAudio = null,
}: {
  id: string
  churchId: string
  day: number
  published?: boolean
  publishedAt?: boolean
  selectedAudio?: Row | null
}) => {
  const owner = store.church.find((c) => c.id === churchId)!
  store.prayerVersion.push({
    id: `v-${id}`,
    prayer_id: id,
    version_number: 1,
    pastor_id: 'pastor-1',
    title: `Title ${id}`,
    introduction: null,
    body: `Body of ${id}.`,
    language_code: 'en',
    pastor: { name: 'Pastor Daniel', introduction: null, image_asset: null },
    selected_audio: selectedAudio,
  })
  store.prayer.push({
    id,
    slug: `${id}-slug`,
    church_id: churchId,
    church: owner,
    current_version_id: `v-${id}`,
    published_version_id: published ? `v-${id}` : null,
    published_at: publishedAt
      ? new Date(`2026-10-${String(day).padStart(2, '0')}T08:00:00Z`)
      : null,
  })
}

const HIDDEN = ['draft', 'scheduled', 'suspended-church']

beforeAll(() => {
  vi.stubEnv('S3_PUBLIC_BASE_URL', CDN)
})

beforeEach(() => {
  store.church = [church('c1', 'APPROVED'), church('c2', 'APPROVED'), church('c3', 'SUSPENDED')]
  store.userChurch = ['c1', 'c2', 'c3'].map((churchId) => ({
    user_id: 'u1',
    church_id: churchId,
    is_main: false,
    is_followed: true,
    church: store.church.find((c) => c.id === churchId),
  }))
  store.prayer = []
  store.prayerVersion = []
  // Visible, oldest first.
  seedPrayer({
    id: 'playable',
    churchId: 'c1',
    day: 1,
    selectedAudio: audio('APPROVED', 'a/playable.mp3'),
  })
  seedPrayer({ id: 'text-only', churchId: 'c2', day: 2 })
  seedPrayer({
    id: 'unapproved-audio',
    churchId: 'c1',
    day: 3,
    selectedAudio: audio('READY', 'a/ready.mp3'),
  })
  seedPrayer({
    id: 'audio-without-file',
    churchId: 'c2',
    day: 4,
    selectedAudio: audio('APPROVED', null),
  })
  // Hidden, newest.
  seedPrayer({ id: 'draft', churchId: 'c1', day: 10, published: false, publishedAt: false })
  seedPrayer({ id: 'scheduled', churchId: 'c1', day: 11, publishedAt: false })
  seedPrayer({ id: 'suspended-church', churchId: 'c3', day: 12 })
})

describe('WB-35 — unpublished prayers never reach the website', () => {
  it('Home feed shows only published prayers of approved churches', async () => {
    const home = await GET_HOME({ userId: 'u1' })
    const ids = home.latestPrayers.map((prayer) => prayer.id)

    expect(ids).toEqual(['audio-without-file', 'unapproved-audio', 'text-only'])
    expect(home.followedChurches.map((c) => c.id).sort()).toEqual(['c1', 'c2'])
  })

  it('archive lists the selected approved church prayers and excludes suspended churches', async () => {
    const archive = await GET_SITE_PRAYER_ARCHIVE({ userId: 'u1', query })
    const ids = [archive.featured!.id, ...archive.result.map((prayer) => prayer.id)]

    expect(ids.sort()).toEqual(['playable', 'unapproved-audio'].sort())
    expect(ids).not.toEqual(expect.arrayContaining(HIDDEN))
    expect(archive.churches.map((c) => c.value).sort()).toEqual(['c1', 'c2'])
  })

  it('a suspended church archive is empty even when opened directly', async () => {
    const archive = await GET_SITE_PRAYER_ARCHIVE({ userId: 'u1', query, fixedChurchId: 'c3' })

    expect(archive.featured).toBeNull()
    expect(archive.result).toEqual([])
    expect(archive.churches).toEqual([])
  })

  it.each(HIDDEN)('prayer detail for %s is not found', async (id) => {
    expect(await GET_SITE_PRAYER_DETAIL({ prayerSlug: id })).toBeNull()
  })

  it('prayer detail siblings never include hidden prayers', async () => {
    const detail = await GET_SITE_PRAYER_DETAIL({ prayerSlug: 'playable' })

    expect(detail?.related.map((prayer) => prayer.id)).toEqual(['unapproved-audio'])
  })
})

describe('WB-35 — only approved audio with a file becomes playable', () => {
  it('Home and archive expose audio for the approved file only; other prayers are text-only', async () => {
    const home = await GET_HOME({ userId: 'u1' })
    const archive = await GET_SITE_PRAYER_ARCHIVE({ userId: 'u1', query })
    const homeAudio = Object.fromEntries(home.latestPrayers.map((p) => [p.id, p.audio]))
    const archiveAudio = Object.fromEntries(
      [archive.featured!, ...archive.result].map((p) => [p.id, p.audio]),
    )

    expect(homeAudio).toEqual({
      'audio-without-file': null,
      'unapproved-audio': null,
      'text-only': null,
    })
    expect(archive.featured?.id).toBe('unapproved-audio')
    expect(archiveAudio['playable']?.url).toBe(`${CDN}/a/playable.mp3`)
    expect(archiveAudio['unapproved-audio']).toBeNull()
  })

  it('format filters follow the same rule', async () => {
    const audioOnly = await GET_SITE_PRAYER_ARCHIVE({
      userId: 'u1',
      query: { ...query, format: 'audio' },
    })
    const textOnly = await GET_SITE_PRAYER_ARCHIVE({
      userId: 'u1',
      query: { ...query, format: 'text' },
    })

    expect(audioOnly.featured?.id).toBe('unapproved-audio')
    expect(audioOnly.result.map((p) => p.id)).toEqual(['playable'])
    expect(textOnly.featured?.id).toBe('unapproved-audio')
    expect(textOnly.result).toEqual([])
  })

  it('the playback URL is a plain public URL: no signature or credentials to attach', async () => {
    const detail = await GET_SITE_PRAYER_DETAIL({ prayerSlug: 'playable' })
    const url = new URL(detail!.prayer.audio!.url)

    expect(url.origin + url.pathname).toBe(`${CDN}/a/playable.mp3`)
    expect(url.search).toBe('')
    expect(url.username + url.password).toBe('')
  })
})
