import { db } from '@/utils/db-connection'
import { S3_PUBLIC_URL } from '@/providers/s3'
import { stripAudioTags } from '@/utils/strip-audio-tags'
import { sanitizePrayerRichText } from '@/utils/sanitize-prayer-rich-text'
import { generatedAudioDurationSeconds, prayerDurationMinutes } from '@/utils/prayer-duration'
import {
  SitePrayerArchive,
  SitePrayerArchiveItem,
  SitePrayerArchiveQuery,
  SitePrayerDetail,
  SiteLoginPrayer,
} from '@/models/site-prayer'

const APPROVED = 'APPROVED'

type PublishedRow = {
  id: string
  slug: string
  church_id: string
  church: {
    name: string
    cover_asset: { object_key: string; purpose: string; status: string } | null
  }
  featured_asset: { object_key: string; purpose: string; status: string } | null
  published_at: Date | null
  published_version_id: string | null
}

const includes = (value: string | null, search: string) =>
  Boolean(value?.toLocaleLowerCase().includes(search))

const publishedSelect = {
  id: true,
  slug: true,
  church_id: true,
  church: {
    select: {
      name: true,
      cover_asset: { select: { object_key: true, purpose: true, status: true } },
    },
  },
  featured_asset: { select: { object_key: true, purpose: true, status: true } },
  published_at: true,
  published_version_id: true,
} as const

const publishedWhere = {
  church: { status: APPROVED },
  published_version_id: { not: null },
  published_at: { not: null },
} as const

/**
 * Fictional parishes created by `prisma/seeds` (demo fixtures). Their prayers and
 * audio are approved like real content, so without this guard a seeded demo prayer
 * becomes the guest hero on /welcome and /login the moment the live database has no
 * playable prayer of its own.
 */
const DEMO_CHURCH_SLUGS = [
  'parnu-st-elizabeths-church',
  'tallinn-demo-church',
  'tartu-demo-church',
  'st-johns-church',
  'st-olafs-church',
]

/** Maps published prayers to reader items in three batched queries (no per-prayer lookups). */
const toItems = async (prayers: PublishedRow[]): Promise<SitePrayerArchiveItem[]> => {
  const churchIds = Array.from(new Set(prayers.map((prayer) => prayer.church_id)))
  const versionIds = prayers
    .map((prayer) => prayer.published_version_id)
    .filter((id): id is string => Boolean(id))
  const versions = versionIds.length
    ? await db.prayerVersion.findMany({
        where: { id: { in: versionIds } },
        include: {
          pastor: { include: { image_asset: { select: { object_key: true } } } },
          selected_audio: { include: { asset: { select: { object_key: true, byte_size: true } } } },
        },
      })
    : []
  const pastorIds = Array.from(new Set(versions.map((version) => version.pastor_id)))
  const churchPastors = pastorIds.length
    ? await db.churchPastor.findMany({
        where: { church_id: { in: churchIds }, pastor_id: { in: pastorIds } },
        include: { image_asset: { select: { object_key: true } } },
      })
    : []
  const versionById = new Map(versions.map((version) => [version.id, version]))
  const churchPastorByKey = new Map(
    churchPastors.map((row) => [`${row.church_id}:${row.pastor_id}`, row]),
  )

  const all = prayers.flatMap<SitePrayerArchiveItem>((prayer) => {
    const version = prayer.published_version_id
      ? versionById.get(prayer.published_version_id)
      : null
    if (!version || !prayer.published_at) return []
    const assignment = churchPastorByKey.get(`${prayer.church_id}:${version.pastor_id}`)
    const imageKey = assignment?.image_asset?.object_key ?? version.pastor.image_asset?.object_key
    const selectedAudio = version.selected_audio
    const durationSeconds = generatedAudioDurationSeconds(selectedAudio?.asset?.byte_size)
    const audioUrl =
      selectedAudio?.status === 'APPROVED' && selectedAudio.asset
        ? S3_PUBLIC_URL({ key: selectedAudio.asset.object_key })
        : null
    return [
      {
        id: prayer.id,
        slug: prayer.slug,
        churchId: prayer.church_id,
        churchName: prayer.church.name,
        churchCoverUrl:
          prayer.church.cover_asset?.purpose === 'IMAGE' &&
          prayer.church.cover_asset.status === 'READY'
            ? S3_PUBLIC_URL({ key: prayer.church.cover_asset.object_key })
            : null,
        featuredImageUrl:
          prayer.featured_asset?.purpose === 'IMAGE' && prayer.featured_asset.status === 'READY'
            ? S3_PUBLIC_URL({ key: prayer.featured_asset.object_key })
            : null,
        publishedAt: prayer.published_at.toISOString(),
        pastorId: version.pastor_id,
        pastorName: version.pastor.name,
        pastorBio: version.pastor.introduction,
        pastorRole: assignment?.pastoral_role ?? null,
        pastorImageUrl: imageKey ? S3_PUBLIC_URL({ key: imageKey }) : null,
        title: stripAudioTags(version.title),
        introduction:
          version.introduction && sanitizePrayerRichText(stripAudioTags(version.introduction)),
        body: sanitizePrayerRichText(stripAudioTags(version.body)),
        languageCode: version.language_code,
        audio:
          selectedAudio?.status === 'APPROVED' && audioUrl
            ? {
                prayerAudioId: selectedAudio.id,
                url: audioUrl,
                approvedAt: selectedAudio.approved_at?.toISOString() ?? '',
                ...(durationSeconds ? { durationSeconds } : {}),
              }
            : null,
      },
    ]
  })
  return all
}

/** Same scope as the unfiltered archive: published prayers of the user's approved main/followed churches. */
export const COUNT_SITE_PRAYERS = ({ userId }: { userId: string }): Promise<number> =>
  db.prayer.count({
    where: {
      ...publishedWhere,
      church: {
        status: APPROVED,
        userChurches: { some: { user_id: userId, OR: [{ is_main: true }, { is_followed: true }] } },
      },
    },
  })

/** Most recently published public prayer that has an approved, playable audio asset. */
export const GET_LATEST_PLAYABLE_SITE_PRAYER = async (): Promise<SiteLoginPrayer | null> => {
  const prayers = (await db.prayer.findMany({
    where: { ...publishedWhere, church: { status: APPROVED, slug: { notIn: DEMO_CHURCH_SLUGS } } },
    orderBy: [{ published_at: 'desc' }, { id: 'desc' }],
    select: publishedSelect,
  })) as PublishedRow[]
  const prayer = (await toItems(prayers)).find((item) => item.audio)

  if (!prayer?.audio) return null

  return {
    id: prayer.id,
    title: prayer.title,
    churchName: prayer.churchName,
    pastorName: prayer.pastorName,
    languageCode: prayer.languageCode,
    audioUrl: prayer.audio.url,
    introduction: prayer.introduction,
    churchCoverUrl: prayer.churchCoverUrl,
  }
}

export const GET_SITE_PRAYER_ARCHIVE = async ({
  userId,
  query,
  fixedChurchId,
  fixedChurchSlug,
}: {
  userId: string
  query: SitePrayerArchiveQuery
  fixedChurchId?: string
  fixedChurchSlug?: string
}): Promise<SitePrayerArchive> => {
  const relationships = await db.userChurch.findMany({
    where: {
      user_id: userId,
      OR: [{ is_main: true }, { is_followed: true }],
      church: { status: APPROVED },
    },
    select: { church_id: true, is_main: true, church: { select: { name: true, slug: true } } },
    orderBy: { church: { name: 'asc' } },
  })

  const relationshipChurches = Array.from(
    new Map(
      relationships.map((row) => [row.church_id, { name: row.church.name, slug: row.church.slug }]),
    ).entries(),
  ).map(([value, info]) => ({ value, label: info.name, slug: info.slug }))

  let scopedChurches = relationshipChurches
  if (fixedChurchSlug || fixedChurchId) {
    const fixed = await db.church.findFirst({
      where: fixedChurchSlug
        ? { slug: fixedChurchSlug, status: APPROVED }
        : { id: fixedChurchId, status: APPROVED },
      select: { id: true, slug: true, name: true },
    })
    scopedChurches = fixed ? [{ value: fixed.id, label: fixed.name, slug: fixed.slug }] : []
  }

  const allowedIds = scopedChurches.map((church) => church.value)
  const defaultChurchId =
    relationships.find((relationship) => relationship.is_main)?.church_id ??
    relationships[0]?.church_id ??
    ''
  const selectedChurchId =
    scopedChurches.length === 1 && (fixedChurchSlug || fixedChurchId)
      ? scopedChurches[0].value
      : fixedChurchId || query.churchId || defaultChurchId
  const churchIds = selectedChurchId
    ? allowedIds.includes(selectedChurchId)
      ? [selectedChurchId]
      : []
    : allowedIds
  const selectedChurchName =
    scopedChurches.find((church) => church.value === selectedChurchId)?.label ?? null

  if (churchIds.length === 0) {
    return {
      result: [],
      featured: null,
      total: 0,
      page: 1,
      limit: query.limit,
      totalPages: 1,
      churches: scopedChurches,
      languages: [],
      selectedChurchId: null,
      selectedChurchName: null,
    }
  }

  const prayers = (await db.prayer.findMany({
    where: { church_id: { in: churchIds }, ...publishedWhere },
    orderBy: [{ published_at: 'desc' }, { id: 'asc' }],
    select: publishedSelect,
  })) as PublishedRow[]

  const all = await toItems(prayers)

  const featured = all[0] ?? null
  const languages = Array.from(new Set(all.map((prayer) => prayer.languageCode))).sort()
  const needle = query.search.toLocaleLowerCase()
  const filtered = all.slice(1).filter((prayer) => {
    if (query.language && prayer.languageCode !== query.language) return false
    if (query.format === 'audio' && !prayer.audio) return false
    if (query.format === 'text' && prayer.audio) return false

    const minutes = prayerDurationMinutes(prayer.body, prayer.audio?.durationSeconds)
    if (query.duration === 'short' && minutes >= 3) return false
    if (query.duration === 'medium' && (minutes < 3 || minutes > 5)) return false
    if (query.duration === 'long' && minutes < 6) return false

    if (!needle) return true
    return [
      prayer.title,
      prayer.introduction,
      prayer.body,
      prayer.pastorName,
      prayer.churchName,
    ].some((value) => includes(value, needle))
  })
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / query.limit))
  const page = Math.min(query.page, totalPages)
  const result = filtered.slice((page - 1) * query.limit, page * query.limit)

  return {
    result,
    featured,
    total,
    page,
    limit: query.limit,
    totalPages,
    churches: scopedChurches,
    languages,
    selectedChurchId,
    selectedChurchName,
  }
}

/** One published prayer for the reader (W10) with its church and up to three newer/older siblings. */
export const GET_SITE_PRAYER_DETAIL = async ({
  prayerSlug,
}: {
  prayerSlug: string
}): Promise<SitePrayerDetail | null> => {
  const row = (await db.prayer.findFirst({
    where: { OR: [{ slug: prayerSlug }, { id: prayerSlug }], ...publishedWhere },
    select: publishedSelect,
  })) as PublishedRow | null
  if (!row) return null

  const [[prayer], church, siblings] = await Promise.all([
    toItems([row]),
    db.church.findUnique({
      where: { id: row.church_id },
      select: {
        id: true,
        slug: true,
        name: true,
        address: true,
        contacts: true,
        cover_asset: { select: { object_key: true, purpose: true, status: true } },
      },
    }),
    db.prayer.findMany({
      where: { church_id: row.church_id, id: { not: row.id }, ...publishedWhere },
      orderBy: [{ published_at: 'desc' }, { id: 'asc' }],
      take: 3,
      select: publishedSelect,
    }) as Promise<PublishedRow[]>,
  ])
  if (!prayer || !church) return null

  const address = church.address as { city?: string } | null
  const contacts = church.contacts as { phone?: unknown } | null
  const phone = typeof contacts?.phone === 'string' ? contacts.phone.trim() || null : null
  const imageUrl =
    church.cover_asset?.purpose === 'IMAGE' && church.cover_asset.status === 'READY'
      ? S3_PUBLIC_URL({ key: church.cover_asset.object_key })
      : null
  return {
    prayer,
    church: {
      id: church.id,
      slug: church.slug,
      name: church.name,
      city: address?.city ?? null,
      phone,
      imageUrl,
    },
    related: await toItems(siblings),
  }
}
