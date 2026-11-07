import { EventCategory, Prisma, RequestKind } from '@prisma/client'
import { unstable_cache } from 'next/cache'
import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import { auditPayload } from '@/utils/audit'
import { SITE_PUBLIC_TAG } from '@/utils/site-cache-tags'
import { fromKind } from '@/providers/request'
import { S3_PUBLIC_URL } from '@/providers/s3'
import {
  MobileAnnouncementListQuery,
  MobileCheckInAck,
  MobileChurchListQuery,
  MobileChurchSummary,
  MobileEventListQuery,
  MobileHome,
  MobileMyChurch,
  MobileNotificationPreferences,
  MobileNotificationType,
  MobilePrayerListQuery,
  MobileDonationOptionsSchema,
  MobilePublicAnnouncement,
  MobilePublicChurch,
  MobilePublicEvent,
  MobilePublishedPrayer,
  MobileRequestInput,
  MOBILE_NOTIFICATION_TYPES,
} from '@/models/mobile'
import { encryptDeviceToken, hashDeviceToken } from '@/utils/device-token'
import { generatedAudioDurationSeconds } from '@/utils/prayer-duration'
import { richTextToPlainText } from '@/utils/rich-text-plain'

/*
 * Mobile shared backend adapter (SPEC §8.4 / Tasks 39-43).
 *
 * Publication discipline: every public/content read is gated on the church
 * having status APPROVED; prayers additionally require published_version_id
 * AND published_at, and serve the PUBLISHED snapshot (never current/draft).
 * Audio is exposed only when the selected audio is APPROVED and has an asset.
 * Intakes (request / check-in / analytics) are idempotent/deduped and return
 * minimal acks — never staff or other-user detail.
 */

const APPROVED = 'APPROVED'

const toIso = (d: Date | null) => (d ? d.toISOString() : null)

const churchAddressLabel = (value: unknown): string | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const address = value as Record<string, unknown>
  const parts = [address.line1, address.line2, address.city].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  )
  return parts.length ? parts.join(', ') : null
}

const notFoundChurch = () =>
  new GeneralError({
    code: 404,
    error: 'NOT_FOUND',
    error_code: 'RESOURCE_NOT_FOUND',
    details: 'Church not found or not available.',
  })

/** Church must exist AND be APPROVED for any mobile read/write. */
const activeChurchWhereId = (id: string): Prisma.ChurchWhereInput => ({
  id,
  status: APPROVED,
})

/*
 * A public church addressed by EITHER identifier. Route params are named
 * `:churchId`, and the mobile clients only ever hold `id` (folders: church
 * profile, prayers, events, announcements), while website URLs and share links
 * carry `slug`. Resolving on only one of the two made every id-addressed call a
 * 404 — the URL segment is an opaque identifier, so accept both. `id` and `slug`
 * are both unique, so an OR can never return the wrong church.
 */
const activeChurchWhereAny = (identifier: string): Prisma.ChurchWhereInput => ({
  status: APPROVED,
  OR: [{ id: identifier }, { slug: identifier }],
})

/* ── Church cover URLs (MB-17) ───────────────────────────────────────────────
 * The bucket is public-read for now (SPEC §10.4.1 / D13), so a cover URL is a
 * plain stable URL — no signature, no expiry. `coverAssetId` stays on the
 * payload; `coverUrl` is null when there is no READY IMAGE asset. */

/** Public cover URL for a READY IMAGE asset. null when absent / not READY / storage not configured. */
const coverUrlFor = async (assetId: string | null): Promise<string | null> => {
  if (!assetId) return null
  const asset = await db.mediaAsset.findFirst({
    where: { id: assetId, status: 'READY', purpose: 'IMAGE' },
    select: { object_key: true },
  })
  return asset ? S3_PUBLIC_URL({ key: asset.object_key }) : null
}

/** Attach `coverUrl` to a mapped summary/profile row. */
const withCover = async <T extends { coverAssetId: string | null }>(
  row: T,
): Promise<T & { coverUrl: string | null }> => ({
  ...row,
  coverUrl: await coverUrlFor(row.coverAssetId),
})

/**
 * Same result as `withCover` for a list, but resolves every cover in ONE query.
 * Mapping `withCover` over a page of churches was an N+1 (one mediaAsset read
 * per row) — on a 24-row directory that is 24 extra round trips.
 */
const withCovers = async <T extends { coverAssetId: string | null }>(
  rows: T[],
): Promise<(T & { coverUrl: string | null })[]> => {
  const assetIds = Array.from(
    new Set(rows.map((row) => row.coverAssetId).filter((id): id is string => !!id)),
  )
  if (assetIds.length === 0) return rows.map((row) => ({ ...row, coverUrl: null }))

  const assets = await db.mediaAsset.findMany({
    where: { id: { in: assetIds }, status: 'READY', purpose: 'IMAGE' },
    select: { id: true, object_key: true },
  })
  const urlById = new Map(
    assets.map((asset) => [asset.id, S3_PUBLIC_URL({ key: asset.object_key })]),
  )
  return rows.map((row) => ({
    ...row,
    coverUrl: row.coverAssetId ? (urlById.get(row.coverAssetId) ?? null) : null,
  }))
}

const galleryUrlFor = (asset: { object_key: string | null } | null | undefined): string | null => {
  if (!asset?.object_key) return null
  return S3_PUBLIC_URL({ key: asset.object_key })
}

const staffImageUrlFor = (
  churchOverride: string | null | undefined,
  canonicalFallback: string | null | undefined,
): string | null => {
  const key = churchOverride || canonicalFallback
  if (!key) return null
  return S3_PUBLIC_URL({ key })
}
/** MB-11 — `coordinates` is a pair or null (same rule as the admin DTO). Prisma `Decimal` → number. */
const toCoordinates = (
  latitude: unknown,
  longitude: unknown,
): { latitude: number; longitude: number } | null =>
  latitude !== null && longitude !== null
    ? { latitude: Number(latitude), longitude: Number(longitude) }
    : null
const toSummary = (
  c: {
    id: string
    slug?: string
    name: string
    denomination: string | null
    church_style?: string | null
    address: unknown
    cover_asset_id: string | null
    latitude: unknown
    longitude: unknown
    description?: string | null
    pastors?: Array<{ pastor: { name: string } }>
    serviceTimes?: Array<{ weekday: number; local_time: Date; label: string | null }>
  },
  lat?: number,
  lng?: number,
): Omit<MobileChurchSummary, 'coverUrl'> => {
  const addr = c.address as { city?: string; line1?: string; line2?: string | null } | null
  const city = addr?.city ?? null
  let distanceKm: number | null = null
  if (lat !== undefined && lng !== undefined && c.latitude !== null && c.longitude !== null) {
    distanceKm = haversineKm(Number(c.latitude), Number(c.longitude), lat, lng)
  }
  const summary: Omit<MobileChurchSummary, 'coverUrl'> = {
    id: c.id,
    slug: c.slug,
    name: c.name,
    denomination: c.denomination,
    city,
    coverAssetId: c.cover_asset_id,
    distanceKm,
    coordinates: toCoordinates(c.latitude, c.longitude),
    latitude: c.latitude !== null && c.longitude !== null ? Number(c.latitude) : null,
    longitude: c.latitude !== null && c.longitude !== null ? Number(c.longitude) : null,
  }
  if (addr?.line1) summary.addressLine1 = addr.line1
  if (addr?.line2) summary.district = addr.line2
  if (c.church_style) summary.churchStyle = c.church_style
  if (c.description) summary.description = c.description
  if (c.pastors?.[0]?.pastor?.name) summary.pastorName = c.pastors[0].pastor.name
  if (c.serviceTimes?.length) {
    summary.serviceTimes = c.serviceTimes
      .map((st) => {
        const time = st.local_time instanceof Date ? st.local_time.toISOString().slice(11, 16) : ''
        return st.label ? `${st.label} ${time}`.trim() : time
      })
      .filter(Boolean)
      .join(' • ')
  }
  return summary
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
}
const WEEKDAY_MAP: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
}

/** Wall-clock weekday (1–7) and minute-of-day in the church timezone (UTC fallback). */
export function churchClock(
  timezone: string,
  now: Date,
): { weekday: number; minutes: number } | null {
  const format = (tz: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    })
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = format(timezone).formatToParts(now)
  } catch {
    parts = format('UTC').formatToParts(now)
  }

  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value?.replace('.', '')
  const weekday = weekdayStr ? WEEKDAY_MAP[weekdayStr] : undefined
  if (!weekday) return null

  const rawHour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const hour = rawHour === 24 ? 0 : rawHour
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return { weekday, minutes: hour * 60 + minute }
}

/** Approximate lat/lng box for a radius, so the DB is not scanned in full. */
const radiusBox = (query: MobileChurchListQuery): Prisma.ChurchWhereInput => {
  if (query.radius_km === undefined) return {}
  if (query.latitude === undefined || query.longitude === undefined) return {}
  const dLat = query.radius_km / 111
  const dLng = dLat / Math.max(Math.cos((query.latitude * Math.PI) / 180), 0.01)
  return {
    latitude: { gte: query.latitude - dLat, lte: query.latitude + dLat },
    longitude: { gte: query.longitude - dLng, lte: query.longitude + dLng },
  }
}

const churchListWhere = (query: MobileChurchListQuery): Prisma.ChurchWhereInput => ({
  status: APPROVED,
  ...radiusBox(query),
  ...(query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { address: { path: ['city'], string_contains: query.search } },
        ],
      }
    : {}),
  // Seed and user-entered values carry a qualifier ("Lutheran (EELK)"), so the
  // filter matches the acronym, not the exact string.
  ...(query.denomination
    ? { denomination: { contains: query.denomination, mode: 'insensitive' } }
    : {}),
  ...(query.language ? { churchLanguages: { some: { language_code: query.language } } } : {}),
  ...(query.sunday_live_stream === true ? { sunday_live_stream: true } : {}),
  ...(query.taize_chants === true ? { taize_chants: true } : {}),
  ...(query.youth_ministry === true ? { youth_ministry: true } : {}),
})

const mapPublicChurch = (
  c: {
    id: string
    slug?: string
    name: string
    denomination: string | null
    description: string | null
    timezone: string
    address: unknown
    latitude: unknown
    longitude: unknown
    contacts: unknown
    website: string | null
    social_links: unknown
    cover_asset_id: string | null
    hero_asset_id: string | null
    hero_asset?: { object_key: string; purpose: string; status: string } | null
    churchLanguages: { language_code: string }[]
    serviceTimes: {
      weekday: number
      local_time: Date
      label: string | null
      language_code: string | null
    }[]
    pastors?: Array<{
      pastoral_role: string
      image_asset?: { object_key: string | null } | null
      pastor: {
        name: string
        image_asset?: { object_key: string | null } | null
      }
    }>
    galleryItems?: Array<{
      caption: string | null
      order_index: number
      media_asset: { id: string; object_key: string | null } | null
    }>
    org_node?: {
      parent: { kind: string; name: string } | null
    } | null
    church_style?: string | null
    donation_options?: unknown
  },
  lat?: number,
  lng?: number,
): Omit<MobilePublicChurch, 'coverUrl'> => {
  const latitude = c.latitude as number | null
  const longitude = c.longitude as number | null
  const addr = (c.address as Record<string, string | null> | null) ?? {}
  const contacts = (c.contacts as Record<string, string | null> | null) ?? {}
  let distanceKm: number | null = null
  if (lat !== undefined && lng !== undefined && latitude !== null && longitude !== null) {
    distanceKm = haversineKm(latitude, longitude, lat, lng)
  }
  return {
    id: c.id,
    slug: c.slug ?? c.id,
    name: c.name,
    denomination: c.denomination,
    description: c.description,
    timezone: c.timezone,
    address: {
      line1: addr.line1 ?? '',
      line2: addr.line2 ?? null,
      city: addr.city ?? '',
      postalCode: addr.postalCode ?? null,
      countryCode: addr.countryCode ?? '',
    },
    coordinates: toCoordinates(latitude, longitude),
    contacts: { email: contacts.email ?? null, phone: contacts.phone ?? null },
    website: c.website,
    socialLinks: Array.isArray(c.social_links)
      ? (c.social_links as Array<{ label: string; url: string }>)
      : [],
    coverAssetId: c.cover_asset_id,
    heroAssetId: c.hero_asset_id ?? null,
    heroUrl:
      c.hero_asset?.purpose === 'IMAGE' && c.hero_asset.status === 'READY'
        ? S3_PUBLIC_URL({ key: c.hero_asset.object_key })
        : null,
    languageCodes: (c.churchLanguages ?? []).map((l) => l.language_code),
    serviceTimes: (c.serviceTimes ?? []).map((s) => ({
      weekday: s.weekday,
      // HH:MM church wall clock (Europe/Tallinn etc. via church.timezone)
      localTime: s.local_time.toISOString().slice(11, 16),
      label: s.label,
      languageCode: s.language_code,
    })),
    distanceKm,
    pastorName: c.pastors?.[0]?.pastor?.name ?? null,
    pastorRole: c.pastors?.[0]?.pastoral_role ?? null,
    pastorImageUrl: c.pastors?.[0]
      ? staffImageUrlFor(
          c.pastors[0].image_asset?.object_key ?? null,
          c.pastors[0].pastor.image_asset?.object_key ?? null,
        )
      : null,
    gallery: (c.galleryItems ?? []).map((g) => ({
      assetId: g.media_asset?.id ?? '',
      url: galleryUrlFor(g.media_asset),
      caption: g.caption,
      orderIndex: g.order_index,
    })),
    staff: (c.pastors ?? []).map((p) => ({
      name: p.pastor.name,
      pastoralRole: p.pastoral_role,
      imageUrl: staffImageUrlFor(
        p.image_asset?.object_key ?? null,
        p.pastor.image_asset?.object_key ?? null,
      ),
    })),
    deaneryName: c.org_node?.parent?.kind === 'DEANERY' ? c.org_node.parent.name : null,
    churchStyle: c.church_style ?? null,
    // Admin-entered JSON: an unparsable legacy blob must degrade to "no options"
    // so the website falls back to its documented defaults rather than crashing.
    donationOptions: MobileDonationOptionsSchema.safeParse(c.donation_options).data,
  }
}

// ---------------------------------------------------------------------------
// Task 39 — discovery / public profile
// ---------------------------------------------------------------------------

const LIST_PUBLIC_CHURCHES_UNCACHED = async ({
  query,
}: {
  query: MobileChurchListQuery
}): Promise<{ result: MobileChurchSummary[]; total: number }> => {
  const where = churchListWhere(query)
  const inMemory =
    query.radius_km !== undefined || (query.latitude !== undefined && query.longitude !== undefined)
  if (!inMemory) {
    const [total, rows] = await db.$transaction([
      db.church.count({ where }),
      db.church.findMany({
        where,
        take: query.limit,
        skip: (query.page - 1) * query.limit,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          slug: true,
          name: true,
          denomination: true,
          church_style: true,
          address: true,
          cover_asset_id: true,
          latitude: true,
          longitude: true,
          description: true,
          pastors: {
            include: { pastor: { select: { name: true } } },
            take: 1,
          },
          serviceTimes: {
            select: { weekday: true, local_time: true, label: true },
            take: 2,
          },
        },
      }),
    ])
    return {
      result: await withCovers(rows.map((r) => toSummary(r, query.latitude, query.longitude))),
      total,
    }
  }

  // Filtering by distance / open-now cannot be expressed in Prisma, so those
  // queries load rows and filter in JS.
  // ponytail: hard cap at 2000 rows — fine for a national directory. Move to
  // PostGIS / earthdistance (or a geohash column) when a region exceeds it.
  const MAX_FILTER_ROWS = 2000
  const rows = await db.church.findMany({
    where,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: MAX_FILTER_ROWS,
    select: {
      id: true,
      slug: true,
      name: true,
      denomination: true,
      church_style: true,
      address: true,
      cover_asset_id: true,
      latitude: true,
      longitude: true,
      description: true,
      timezone: true,
      pastors: {
        include: { pastor: { select: { name: true } } },
        take: 1,
      },
      serviceTimes: {
        select: { weekday: true, local_time: true, label: true },
      },
    },
  })

  let pairs = rows.map((r) => ({
    row: r,
    summary: toSummary(
      { ...r, serviceTimes: r.serviceTimes?.slice(0, 2) },
      query.latitude,
      query.longitude,
    ),
  }))

  if (query.radius_km !== undefined) {
    pairs = pairs.filter(
      (p) => p.summary.distanceKm !== null && p.summary.distanceKm <= query.radius_km!,
    )
  }

  if (query.latitude !== undefined && query.longitude !== undefined) {
    pairs.sort((a, b) => {
      const distA = a.summary.distanceKm ?? Number.POSITIVE_INFINITY
      const distB = b.summary.distanceKm ?? Number.POSITIVE_INFINITY
      return distA - distB
    })
  }

  const total = pairs.length
  const paged = pairs.slice((query.page - 1) * query.limit, query.page * query.limit)
  const result = await withCovers(paged.map((p) => p.summary))

  return { result, total }
}

/**
 * Public church directory. Identical for every visitor, so it is cached for a
 * minute and tagged for invalidation (approving/editing a church should call
 * `revalidateTag(SITE_PUBLIC_TAG)`).
 */
export const LIST_PUBLIC_CHURCHES = unstable_cache(
  LIST_PUBLIC_CHURCHES_UNCACHED,
  ['site-public-churches'],
  { revalidate: 60, tags: [SITE_PUBLIC_TAG] },
)

const GET_PUBLIC_CHURCH_UNCACHED = async ({
  slug,
  churchId,
  lat,
  lng,
}: {
  slug?: string
  churchId?: string
  lat?: number
  lng?: number
}): Promise<MobilePublicChurch | null> => {
  const target = slug ?? churchId ?? ''
  const row = await db.church.findFirst({
    where: activeChurchWhereAny(target),
    include: {
      churchLanguages: { select: { language_code: true } },
      serviceTimes: {
        orderBy: [{ weekday: 'asc' } as const],
      },
      pastors: {
        where: { pastor: { deleted_at: null } },
        include: {
          pastor: {
            select: {
              name: true,
              image_asset: { select: { object_key: true } },
            },
          },
          image_asset: { select: { object_key: true } },
        },
      },
      galleryItems: {
        where: {
          media_asset: {
            status: 'READY' as const,
            purpose: 'IMAGE' as const,
          },
        },
        orderBy: [{ order_index: 'asc' } as const],
        select: {
          caption: true,
          order_index: true,
          media_asset: {
            select: { id: true, object_key: true },
          },
        },
      },
      hero_asset: { select: { object_key: true, purpose: true, status: true } },
      org_node: {
        select: {
          parent: {
            select: {
              kind: true,
              name: true,
            },
          },
        },
      },
    },
  })
  if (!row) return null
  return withCover(mapPublicChurch(row as never, lat, lng))
}

/** Public church profile — cached like the directory (same tag). */
export const GET_PUBLIC_CHURCH = unstable_cache(
  GET_PUBLIC_CHURCH_UNCACHED,
  ['site-public-church'],
  { revalidate: 60, tags: [SITE_PUBLIC_TAG] },
)

// ---------------------------------------------------------------------------
// Task 40 — home / me / my churches / follows
// ---------------------------------------------------------------------------

export const GET_ME_PROFILE = async ({
  userId,
}: {
  userId: string
}): Promise<{
  id: string
  email: string
  name: string
  locale: string | null
  profilePicture: string | null
  mainChurchId: string | null
  mainChurchName: string | null
  churchSetupCompletedAt: Date | null
  localeSetupCompletedAt: Date | null
} | null> => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      locale: true,
      profile_picture: true,
      church_setup_completed_at: true,
      locale_setup_completed_at: true,
    },
  })
  if (!user) return null
  const main = await db.userChurch.findFirst({
    where: { user_id: userId, is_main: true },
    select: { church: { select: { id: true, name: true } } },
  })
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale,
    profilePicture: user.profile_picture,
    mainChurchId: main?.church.id ?? null,
    mainChurchName: main?.church.name ?? null,
    churchSetupCompletedAt: user.church_setup_completed_at,
    localeSetupCompletedAt: user.locale_setup_completed_at,
  }
}

/** Transactional main-church update: at most ONE is_main row per user. */
export const UPDATE_ME_PROFILE = async ({
  userId,
  name,
  locale,
  localeChosen = true,
  mainChurchId,
  profilePicture,
}: {
  userId: string
  name?: string
  locale?: string | null
  localeChosen?: boolean
  mainChurchId?: string | null
  profilePicture?: string | null
}): Promise<MobileChurchSummary['id']> => {
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        name: name ?? undefined,
        locale: locale ?? undefined,
        // explicit null clears the avatar; undefined leaves it untouched
        profile_picture: profilePicture === undefined ? undefined : profilePicture,
      },
    })
    // Onboarding (WB-15): a chosen language / church fills its setup step
    // (first time only). A skipped step stays unfilled.
    if (locale && localeChosen) {
      await tx.user.updateMany({
        where: { id: userId, locale_setup_completed_at: null },
        data: { locale_setup_completed_at: new Date() },
      })
    }
    if (mainChurchId === undefined) return
    if (mainChurchId) {
      const church = await tx.church.findFirst({
        where: activeChurchWhereId(mainChurchId),
        select: { id: true },
      })
      if (!church) throw notFoundChurch()
      await tx.user.updateMany({
        where: { id: userId, church_setup_completed_at: null },
        data: { church_setup_completed_at: new Date() },
      })
      await tx.userChurch.updateMany({ where: { user_id: userId }, data: { is_main: false } })
      await tx.userChurch.upsert({
        where: { user_id_church_id: { user_id: userId, church_id: mainChurchId } },
        create: { user_id: userId, church_id: mainChurchId, is_main: true, is_followed: true },
        update: { is_main: true, is_followed: true },
      })
    } else {
      await tx.userChurch.updateMany({ where: { user_id: userId }, data: { is_main: false } })
    }
  })
  return mainChurchId ?? ''
}

export const LIST_MY_CHURCHES = async ({
  userId,
}: {
  userId: string
}): Promise<MobileMyChurch[]> => {
  const rows = await db.userChurch.findMany({
    where: { user_id: userId, church: { status: APPROVED } },
    orderBy: [{ is_main: 'desc' }, { church: { name: 'asc' } }],
    select: {
      is_main: true,
      is_followed: true,
      church: {
        select: {
          id: true,
          slug: true,
          name: true,
          address: true,
          cover_asset_id: true,
          status: true,
        },
      },
    },
  })
  // One mediaAsset read for the whole list: mapping `withCover` here made this an
  // N+1 (a read per followed church) — the same defect the directory already fixed.
  return withCovers(
    rows
      .filter((r) => r.church.status === APPROVED)
      .map((r) => ({
        churchId: r.church.id,
        slug: r.church.slug,
        churchName: r.church.name,
        city: (r.church.address as { city?: string } | null)?.city ?? null,
        address: churchAddressLabel(r.church.address),
        coverAssetId: r.church.cover_asset_id,
        isMain: r.is_main,
        isFollowed: r.is_followed,
      })),
  )
}

export const SET_FOLLOW = async ({
  userId,
  churchId,
  isFollowed,
}: {
  userId: string
  churchId: string
  isFollowed: boolean
}): Promise<{ churchId: string; isFollowed: boolean } | null> => {
  const church = await db.church.findFirst({
    where: activeChurchWhereId(churchId),
    select: { id: true },
  })
  if (!church) return null
  await db.userChurch.upsert({
    where: { user_id_church_id: { user_id: userId, church_id: churchId } },
    create: { user_id: userId, church_id: churchId, is_followed: isFollowed },
    update: { is_followed: isFollowed },
  })
  return { churchId, isFollowed }
}

export const GET_HOME = async ({ userId }: { userId: string }): Promise<MobileHome> => {
  const rows = await db.userChurch.findMany({
    where: { user_id: userId, church: { status: APPROVED } },
    select: {
      is_main: true,
      is_followed: true,
      church_id: true,
      church: {
        select: {
          slug: true,
        },
      },
    },
    orderBy: [{ is_main: 'desc' }],
  })
  const approved = rows.filter(
    (r) =>
      // approved enforced by where; both flags default relationship if main or followed
      r.is_main || r.is_followed,
  )
  const mainRow = approved.find((r) => r.is_main)
  const prayerChurchIds = Array.from(
    new Set(approved.filter((r) => r.is_main || r.is_followed).map((r) => r.church_id)),
  )
  const followedIds = approved.filter((r) => r.is_followed).map((r) => r.church_id)

  // Everything below depends only on the rows above, so it runs in parallel —
  // the previous version awaited main church -> events -> announcements -> prayers
  // one after another (4 round trips instead of 1).
  const [mainChurch, latestEvents, latestAnnouncements, latestPrayers, followedRows] =
    await Promise.all([
      mainRow
        ? GET_PUBLIC_CHURCH({ slug: mainRow.church?.slug ?? mainRow.church_id })
        : Promise.resolve(null),
      mainRow
        ? LIST_PUBLIC_EVENTS({ churchId: mainRow.church_id, query: { page: 1, limit: 3 } }).then(
            (page) => page.result,
          )
        : Promise.resolve([] as MobilePublicEvent[]),
      mainRow
        ? LIST_PUBLIC_ANNOUNCEMENTS({
            churchId: mainRow.church_id,
            query: { page: 1, limit: 3 },
          }).then((page) => page.result)
        : Promise.resolve([] as MobilePublicAnnouncement[]),
      prayerChurchIds.length
        ? LIST_LATEST_PUBLISHED_PRAYERS({ churchIds: prayerChurchIds, limit: 3 })
        : Promise.resolve([] as MobilePublishedPrayer[]),
      followedIds.length
        ? db.church.findMany({
            where: { id: { in: followedIds }, status: APPROVED },
            select: {
              id: true,
              slug: true,
              name: true,
              denomination: true,
              church_style: true,
              address: true,
              cover_asset_id: true,
              latitude: true,
              longitude: true,
            },
          })
        : Promise.resolve([]),
    ])

  return {
    mainChurch,
    followedChurches: await withCovers(followedRows.map((f) => toSummary(f))),
    latestPrayers,
    latestEvents,
    latestAnnouncements,
  }
}

// ---------------------------------------------------------------------------
// Task 41 — published prayers / approved audio
// ---------------------------------------------------------------------------

const publishedPrayerWhere = (churchId: string | string[]): Prisma.PrayerWhereInput => ({
  church_id: Array.isArray(churchId) ? { in: churchId } : churchId,
  church: { status: APPROVED },
  published_version_id: { not: null },
  published_at: { not: null },
})

const mapPublishedPrayer = (p: {
  id: string
  slug: string
  church_id: string
  church: {
    name: string
    cover_asset: { object_key: string; purpose: string; status: string } | null
  }
  featured_asset_id: string | null
  featured_asset: { object_key: string; purpose: string; status: string } | null
  published_at: Date | null
  version: {
    id: string
    version_number: number
    pastor_id: string
    title: string
    introduction: string | null
    body: string
    language_code: string
    pastor: {
      name: string
      image_asset?: { object_key: string } | null
      /** The pastor's per-church assignments; the one for this prayer's church may override the image. */
      churchPastors?: { church_id: string; image_asset: { object_key: string } | null }[]
    }
    selected_audio: {
      id: string
      status: string
      approved_at: Date | null
      approved_by: string | null
      asset: { id: string; object_key: string; byte_size?: bigint | number | null } | null
    } | null
  } | null
}): MobilePublishedPrayer | null => {
  if (!p.version) return null
  const audio = p.version.selected_audio
  const approved = audio && audio.status === 'APPROVED' && audio.asset
  return {
    id: p.id,
    slug: p.slug,
    churchId: p.church_id,
    churchName: p.church.name,
    churchCoverUrl:
      p.church.cover_asset?.purpose === 'IMAGE' && p.church.cover_asset.status === 'READY'
        ? S3_PUBLIC_URL({ key: p.church.cover_asset.object_key })
        : null,
    featuredAssetId: p.featured_asset_id ?? null,
    featuredImageUrl:
      p.featured_asset?.purpose === 'IMAGE' && p.featured_asset.status === 'READY'
        ? S3_PUBLIC_URL({ key: p.featured_asset.object_key })
        : null,
    publishedAt: toIso(p.published_at) ?? '',
    version: {
      prayerVersionId: p.version.id,
      versionNumber: p.version.version_number,
      pastorId: p.version.pastor_id,
      pastorName: p.version.pastor.name,
      pastorImageUrl: staffImageUrlFor(
        p.version.pastor.churchPastors?.find((c) => c.church_id === p.church_id)?.image_asset
          ?.object_key,
        p.version.pastor.image_asset?.object_key,
      ),
      title: p.version.title,
      introduction: p.version.introduction
        ? richTextToPlainText(p.version.introduction) || null
        : null,
      body: richTextToPlainText(p.version.body),
      languageCode: p.version.language_code,
    },
    audio: approved
      ? {
          prayerAudioId: audio.id,
          assetId: audio.asset!.id,
          assetKey: audio.asset!.object_key,
          assetUrl: S3_PUBLIC_URL({ key: audio.asset!.object_key }),
          durationSeconds: generatedAudioDurationSeconds(audio.asset!.byte_size),
          approvedAt: toIso(audio.approved_at) ?? '',
        }
      : null,
  }
}

const LIST_PUBLISHED_PRAYERS_UNCACHED = async ({
  churchId,
  query,
}: {
  churchId: string
  query: MobilePrayerListQuery
}): Promise<{ result: MobilePublishedPrayer[]; total: number }> => {
  const where = publishedPrayerWhere(churchId)
  const [total, rows] = await db.$transaction([
    db.prayer.count({ where }),
    db.prayer.findMany({
      where,
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      orderBy: [{ published_at: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        slug: true,
        church_id: true,
        featured_asset_id: true,
        featured_asset: { select: { object_key: true, purpose: true, status: true } },
        church: {
          select: {
            name: true,
            cover_asset: { select: { object_key: true, purpose: true, status: true } },
          },
        },
        published_at: true,
        published_version_id: true,
      },
    }),
  ])
  const versionIds = rows.map((r) => r.published_version_id).filter((v): v is string => Boolean(v))
  const versions = versionIds.length
    ? await db.prayerVersion.findMany({
        where: { id: { in: versionIds } },
        include: {
          pastor: {
            select: {
              name: true,
              image_asset: { select: { object_key: true } },
              churchPastors: {
                select: { church_id: true, image_asset: { select: { object_key: true } } },
              },
            },
          },
          selected_audio: {
            include: { asset: { select: { id: true, object_key: true, byte_size: true } } },
          },
        },
      })
    : []
  const versionById = new Map(versions.map((v) => [v.id, v]))
  const result = rows
    .map((r) =>
      mapPublishedPrayer({
        id: r.id,
        slug: r.slug,
        church_id: r.church_id,
        featured_asset_id: r.featured_asset_id,
        featured_asset: r.featured_asset,
        church: r.church,
        published_at: r.published_at,
        version: r.published_version_id
          ? ((versionById.get(r.published_version_id) as never) ?? null)
          : null,
      }),
    )
    .filter((x): x is MobilePublishedPrayer => Boolean(x))
  return { result, total }
}

/**
 * Public, per-church published prayers: identical for every visitor, so it is
 * cached for a minute and tagged — the prayer publish and audio-approve routes
 * already call `revalidateTag(SITE_PUBLIC_TAG)`, so a new prayer appears at once.
 * Uncached this cost ~12 round trips per call, which the W11 neighbour spotlight
 * paid for every probed parish on each /donate render (measured 507 ms, 25 Oct
 * 2026 — the heaviest single read on the giving page).
 */
export const LIST_PUBLISHED_PRAYERS = unstable_cache(
  LIST_PUBLISHED_PRAYERS_UNCACHED,
  ['site-public-published-prayers'],
  { revalidate: 60, tags: [SITE_PUBLIC_TAG] },
)

/** Latest published prayers across the customer's main and followed churches. */
const LIST_LATEST_PUBLISHED_PRAYERS_UNCACHED = async ({
  churchIds,
  limit,
}: {
  churchIds: string[]
  limit: number
}): Promise<MobilePublishedPrayer[]> => {
  if (!churchIds.length) return []
  const where = publishedPrayerWhere(churchIds)
  const rows = await db.prayer.findMany({
    where,
    take: limit,
    orderBy: [{ published_at: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      slug: true,
      church_id: true,
      featured_asset_id: true,
      featured_asset: { select: { object_key: true, purpose: true, status: true } },
      church: {
        select: {
          name: true,
          cover_asset: { select: { object_key: true, purpose: true, status: true } },
        },
      },
      published_at: true,
      published_version_id: true,
    },
  })
  const versionIds = rows.map((row) => row.published_version_id).filter((id): id is string => !!id)
  const versions = versionIds.length
    ? await db.prayerVersion.findMany({
        where: { id: { in: versionIds } },
        include: {
          pastor: {
            select: {
              name: true,
              image_asset: { select: { object_key: true } },
              churchPastors: {
                select: { church_id: true, image_asset: { select: { object_key: true } } },
              },
            },
          },
          selected_audio: {
            include: { asset: { select: { id: true, object_key: true, byte_size: true } } },
          },
        },
      })
    : []
  const versionById = new Map(versions.map((version) => [version.id, version]))
  return rows
    .map((row) =>
      mapPublishedPrayer({
        id: row.id,
        slug: row.slug,
        church_id: row.church_id,
        featured_asset_id: row.featured_asset_id,
        featured_asset: row.featured_asset,
        church: row.church,
        published_at: row.published_at,
        version: row.published_version_id
          ? ((versionById.get(row.published_version_id) as never) ?? null)
          : null,
      }),
    )
    .filter((prayer): prayer is MobilePublishedPrayer => !!prayer)
}

export const GET_PUBLISHED_PRAYER = async ({
  prayerId,
}: {
  prayerId: string
}): Promise<MobilePublishedPrayer | null> => {
  const p = await db.prayer.findFirst({
    where: {
      id: prayerId,
      church: { status: APPROVED },
      published_version_id: { not: null },
      published_at: { not: null },
    },
    select: {
      id: true,
      slug: true,
      church_id: true,
      featured_asset_id: true,
      featured_asset: { select: { object_key: true, purpose: true, status: true } },
      church: {
        select: {
          name: true,
          cover_asset: { select: { object_key: true, purpose: true, status: true } },
        },
      },
      published_at: true,
      published_version_id: true,
    },
  })
  if (!p || !p.published_version_id) return null
  const version = await db.prayerVersion.findFirst({
    where: { id: p.published_version_id, prayer_id: p.id },
    include: {
      pastor: {
        select: {
          name: true,
          image_asset: { select: { object_key: true } },
          churchPastors: {
            select: { church_id: true, image_asset: { select: { object_key: true } } },
          },
        },
      },
      selected_audio: {
        include: { asset: { select: { id: true, object_key: true, byte_size: true } } },
      },
    },
  })
  return mapPublishedPrayer({
    id: p.id,
    slug: p.slug,
    church_id: p.church_id,
    featured_asset_id: p.featured_asset_id,
    featured_asset: p.featured_asset,
    church: p.church,
    published_at: p.published_at,
    version: (version as never) ?? null,
  })
}

/** Latest published prayers for a set of churches — public content, cached. */
export const LIST_LATEST_PUBLISHED_PRAYERS = unstable_cache(
  LIST_LATEST_PUBLISHED_PRAYERS_UNCACHED,
  ['site-public-latest-prayers'],
  { revalidate: 60, tags: [SITE_PUBLIC_TAG] },
)

// ---------------------------------------------------------------------------
// Task 42 — published events + announcements
// ---------------------------------------------------------------------------

export const LIST_PUBLIC_EVENTS = async ({
  churchId,
  query,
}: {
  churchId: string
  query: MobileEventListQuery
}): Promise<{ result: MobilePublicEvent[]; total: number }> => {
  const now = new Date()
  const where: Prisma.EventWhereInput = {
    church_id: churchId,
    church: { status: APPROVED },
    starts_at: { gte: now },
    ...(query.category ? { category: query.category.toUpperCase() as EventCategory } : {}),
  }
  const [total, rows] = await db.$transaction([
    db.event.count({ where }),
    db.event.findMany({
      where,
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      orderBy: [{ starts_at: 'asc' }, { id: 'asc' }],
    }),
  ])
  return {
    result: rows.map((e) => ({
      id: e.id,
      churchId: e.church_id,
      category: e.category.toLowerCase(),
      title: e.title,
      description: e.description,
      startsAt: e.starts_at.toISOString(),
      location: e.location,
      registrationUrl: e.registration_url,
      languageCode: e.language_code,
      ctaLabel: 'cta_label' in e && typeof e.cta_label === 'string' ? e.cta_label : null,
    })),
    total,
  }
}

export const LIST_PUBLIC_ANNOUNCEMENTS = async ({
  churchId,
  query,
}: {
  churchId: string
  query: MobileAnnouncementListQuery
}): Promise<{ result: MobilePublicAnnouncement[]; total: number }> => {
  const where: Prisma.AnnouncementWhereInput = {
    church_id: churchId,
    church: { status: APPROVED },
    published_at: { not: null },
    deleted_at: null,
  }
  const [total, rows] = await db.$transaction([
    db.announcement.count({ where }),
    db.announcement.findMany({
      where,
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      orderBy: [{ published_at: 'desc' }, { id: 'asc' }],
    }),
  ])
  return {
    result: rows
      .filter((a): a is typeof a & { published_at: Date } => a.published_at !== null)
      .map((a) => ({
        id: a.id,
        churchId: a.church_id,
        title: a.title,
        body: a.body,
        publishedAt: a.published_at.toISOString(),
      })),
    total,
  }
}

// ---------------------------------------------------------------------------
// Task 43 — request / check-in / analytics intake
// ---------------------------------------------------------------------------

const KIND_TO_DB: Record<string, RequestKind> = {
  prayer: 'PRAYER',
  pastoral: 'PASTORAL',
  meeting: 'MEETING',
}

/** Minimal ack — the sensitive fields never leave the request handler. */
export const CREATE_USER_REQUEST = async ({
  churchId,
  userId,
  data,
  requestId,
  tx,
}: {
  churchId: string
  userId: string
  data: MobileRequestInput
  requestId: string
  tx: Prisma.TransactionClient | null
}): Promise<{ id: string; kind: string; createdAt: string }> => {
  const client: Prisma.TransactionClient = tx ?? (db as unknown as Prisma.TransactionClient)
  const created = await client.request.create({
    data: {
      church_id: churchId,
      user_id: userId,
      kind: KIND_TO_DB[data.kind],
      subject: data.subject ?? null,
      message: data.message,
      classification: data.classification ?? null,
      contact_method: data.contactMethod,
      phone: data.phone ?? null,
      email: data.email ?? null,
      availability: data.availability ?? null,
    },
  })
  await client.auditLog.create({
    data: auditPayload({
      actorId: userId,
      churchId,
      action: 'request.submit',
      resourceType: 'request',
      resourceId: created.id,
      outcome: 'success',
      requestId,
    }),
  })
  return { id: created.id, kind: data.kind, createdAt: created.created_at.toISOString() }
}

/**
 * User's submissions to ANY church since `since` (submission rate limit). Per user, not per
 * church, so posting to many churches cannot multiply the allowance.
 */
export const COUNT_RECENT_USER_REQUESTS = async ({
  userId,
  since,
  tx,
}: {
  userId: string
  since: Date
  tx: Prisma.TransactionClient | null
}): Promise<number> => {
  const client: Prisma.TransactionClient = tx ?? (db as unknown as Prisma.TransactionClient)
  return client.request.count({
    where: { user_id: userId, created_at: { gte: since } },
  })
}

/** Ack for an already-accepted submission (idempotent replay). Own rows only. */
export const GET_USER_REQUEST_ACK = async ({
  id,
  userId,
}: {
  id: string
  userId: string
}): Promise<{ id: string; kind: string; createdAt: string } | null> => {
  const row = await db.request.findFirst({
    where: { id, user_id: userId },
    select: { id: true, kind: true, created_at: true },
  })
  return row
    ? { id: row.id, kind: fromKind(row.kind), createdAt: row.created_at.toISOString() }
    : null
}

/** Church-timezone local calendar date string YYYY-MM-DD (falls back to UTC). */
export function churchLocalDate(occurredAt: Date, timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return fmt.format(occurredAt)
  } catch {
    return occurredAt.toISOString().slice(0, 10)
  }
}

/** D7 dedupe: one user/church/local-date via unique dedupe_key. Idempotent. */
export const CREATE_CHECKIN = async ({
  churchId,
  userId,
  requestId,
}: {
  churchId: string
  userId: string
  requestId: string
}): Promise<MobileCheckInAck> => {
  const church = await db.church.findFirst({
    where: activeChurchWhereId(churchId),
    select: { id: true, timezone: true },
  })
  if (!church) throw notFoundChurch()
  const occurredAt = new Date()
  const localDate = churchLocalDate(occurredAt, church.timezone)
  const dedupeKey = `${userId}:${churchId}:${localDate}`
  const inserted = await db.checkIn.createMany({
    data: {
      church_id: churchId,
      user_id: userId,
      occurred_at: occurredAt,
      local_date: new Date(`${localDate}T00:00:00.000Z`),
      dedupe_key: dedupeKey,
    },
    skipDuplicates: true,
  })
  const row =
    inserted.count > 0
      ? await db.checkIn.findFirst({ where: { dedupe_key: dedupeKey, church_id: churchId } })
      : await db.checkIn.findFirst({ where: { dedupe_key: dedupeKey } })
  await db.auditLog.create({
    data: auditPayload({
      actorId: userId,
      churchId,
      action: 'checkin.create',
      resourceType: 'checkin',
      resourceId: row?.id ?? null,
      outcome: 'success',
      requestId,
    }),
  })
  return {
    id: row?.id ?? dedupeKey,
    churchId,
    occurredAt: occurredAt.toISOString(),
    localDate,
  }
}

/** Allowlist + dedupe by event_key (unique in DB) via skipDuplicates. */
export const CREATE_ANALYTICS_EVENTS = async ({
  userId,
  events,
  requestId,
}: {
  userId: string
  events: Array<{
    eventKey?: string
    eventType: string
    occurredAt: string
    churchId?: string | null
    resourceId?: string | null
  }>
  requestId: string
}): Promise<{ accepted: number }> => {
  const now = new Date()
  const data = events.map((e, i) => {
    const eventKey =
      e.eventKey ?? `user:${userId}:${e.eventType}:${e.occurredAt}:${i}:${Date.now().toString(36)}`
    return {
      event_key: eventKey,
      church_id: e.churchId ?? null,
      user_id: userId,
      event_type: e.eventType,
      occurred_at: new Date(e.occurredAt),
      received_at: now,
      resource_id: e.resourceId ?? null,
    }
  })
  const res = await db.analyticsEvent.createMany({ data, skipDuplicates: true })
  await db.auditLog.create({
    data: auditPayload({
      actorId: userId,
      action: 'analytics.record',
      resourceType: 'analytics_event',
      outcome: 'success',
      requestId,
    }),
  })
  return { accepted: res.count }
}

// ---------------------------------------------------------------------------
// F12 — notification preferences + devices (MB-04 / MB-05)
// ---------------------------------------------------------------------------

/** Missing rows mean ENABLED (client decision 2026-10-30: all six start on). */
export const GET_NOTIFICATION_PREFERENCES = async ({ userId }: { userId: string }) => {
  const rows = await db.notificationPreference.findMany({
    where: { user_id: userId, type: { in: [...MOBILE_NOTIFICATION_TYPES] } },
  })
  const byType = new Map(rows.map((r) => [r.type, r.enabled]))
  return {
    dailyPrayer: byType.get('daily_prayer') ?? true,
    sundayService: byType.get('sunday_service') ?? true,
    churchEvents: byType.get('church_events') ?? true,
    announcements: byType.get('announcements') ?? true,
    platformInformation: byType.get('platform_information') ?? true,
    donationReminder: byType.get('donation_reminder') ?? true,
  }
}

export const UPSERT_NOTIFICATION_PREFERENCES = async (
  { userId, prefs }: { userId: string; prefs: MobileNotificationPreferences },
  tx: Prisma.TransactionClient = db,
) => {
  const values: Array<[MobileNotificationType, boolean]> = [
    ['daily_prayer', prefs.dailyPrayer],
    ['sunday_service', prefs.sundayService],
    ['church_events', prefs.churchEvents],
    ['announcements', prefs.announcements],
    ['platform_information', prefs.platformInformation],
    ['donation_reminder', prefs.donationReminder],
  ]
  for (const [type, enabled] of values) {
    await tx.notificationPreference.upsert({
      where: { user_id_type: { user_id: userId, type } },
      create: { user_id: userId, type, enabled },
      update: { enabled },
    })
  }
}

export const UPSERT_DEVICE_TOKEN = async (
  {
    userId,
    installationId,
    platform,
    token,
  }: { userId: string; installationId: string; platform: 'ios' | 'android'; token: string },
  tx: Prisma.TransactionClient = db,
) => {
  const token_hash = hashDeviceToken(token)
  // Account switch: the same installation must not stay bound to another user.
  await tx.deviceToken.updateMany({
    where: { installation_id: installationId, user_id: { not: userId }, disabled_at: null },
    data: { disabled_at: new Date() },
  })
  // Rotation: the user's older token for this installation is retired.
  await tx.deviceToken.updateMany({
    where: {
      installation_id: installationId,
      user_id: userId,
      token_hash: { not: token_hash },
      disabled_at: null,
    },
    data: { disabled_at: new Date() },
  })
  return tx.deviceToken.upsert({
    where: { token_hash },
    create: {
      user_id: userId,
      installation_id: installationId,
      platform,
      token_ciphertext: encryptDeviceToken(token),
      token_hash,
    },
    update: {
      user_id: userId,
      installation_id: installationId,
      platform,
      token_ciphertext: encryptDeviceToken(token),
      disabled_at: null,
    },
  })
}

export const DISABLE_DEVICE_TOKEN = async ({
  userId,
  installationId,
}: {
  userId: string
  installationId: string
}) =>
  db.deviceToken.updateMany({
    where: { user_id: userId, installation_id: installationId, disabled_at: null },
    data: { disabled_at: new Date() },
  })

export const MARK_DEVICE_DISABLED = async ({ deviceTokenId }: { deviceTokenId: string }) =>
  db.deviceToken.update({ where: { id: deviceTokenId }, data: { disabled_at: new Date() } })

/** The agreed audience: active users whose main or followed church is this church. */
export const GET_NOTIFICATION_RECIPIENTS = async ({ churchId }: { churchId: string }) =>
  db.userChurch.findMany({
    where: {
      church_id: churchId,
      OR: [{ is_main: true }, { is_followed: true }],
      user: { status: 'active' },
    },
    select: { user_id: true, user: { select: { email: true, name: true } } },
  })

export const GET_ACTIVE_DEVICES_FOR_USERS = async ({ userIds }: { userIds: string[] }) =>
  db.deviceToken.findMany({
    where: { user_id: { in: userIds }, disabled_at: null },
    select: { id: true, user_id: true, token_ciphertext: true },
  })

/** One query for the whole audience; missing rows mean enabled. */
export const GET_PREFERENCE_MAP_FOR_USERS = async ({ userIds }: { userIds: string[] }) => {
  const rows = await db.notificationPreference.findMany({
    where: { user_id: { in: userIds }, type: { in: [...MOBILE_NOTIFICATION_TYPES] } },
  })
  const map = new Map<string, Map<string, boolean>>()
  for (const row of rows) {
    if (!map.has(row.user_id)) map.set(row.user_id, new Map())
    map.get(row.user_id)!.set(row.type, row.enabled)
  }
  return map
}

/** Devices that already received this event are not sent again on a job retry. */
export const FILTER_UNDELIVERED_DEVICES = async ({
  eventKey,
  deviceTokenIds,
}: {
  eventKey: string
  deviceTokenIds: string[]
}) => {
  const rows = await db.notificationDelivery.findMany({
    where: { event_key: eventKey, device_token_id: { in: deviceTokenIds }, status: 'sent' },
    select: { device_token_id: true },
  })
  const sent = new Set(rows.map((r) => r.device_token_id))
  return new Set(deviceTokenIds.filter((id) => !sent.has(id)))
}

export const UPSERT_NOTIFICATION_DELIVERY = async ({
  ruleId,
  userId,
  deviceTokenId,
  eventKey,
}: {
  ruleId: string
  userId: string
  deviceTokenId: string
  eventKey: string
}) =>
  db.notificationDelivery.upsert({
    where: {
      event_key_user_id_device_token_id: {
        event_key: eventKey,
        user_id: userId,
        device_token_id: deviceTokenId,
      },
    },
    create: {
      rule_id: ruleId,
      user_id: userId,
      device_token_id: deviceTokenId,
      event_key: eventKey,
      status: 'queued',
    },
    update: {},
  })

export const MARK_NOTIFICATION_DELIVERY = async ({
  id,
  status,
}: {
  id: string
  status: 'sent' | 'failed' | 'skipped'
}) => db.notificationDelivery.update({ where: { id }, data: { status } })

export const GET_NOTIFICATION_CONTENT = async ({
  type,
  resourceId,
  churchId,
}: {
  type: string
  resourceId: string | null
  churchId: string
}) => {
  const church = await db.church.findUnique({
    where: { id: churchId },
    select: { name: true, slug: true },
  })
  if (!church) return null
  if (type === 'prayer_published' && resourceId) {
    const prayer = await db.prayer.findFirst({
      where: { id: resourceId, church_id: churchId, published_at: { not: null } },
      select: { published_version_id: true },
    })
    const version = prayer?.published_version_id
      ? await db.prayerVersion.findUnique({
          where: { id: prayer.published_version_id },
          select: { title: true },
        })
      : null
    if (!version) return null
    return {
      title: `New prayer from ${church.name}`,
      body: version.title,
      churchName: church.name,
      churchSlug: church.slug,
    }
  }
  if (type === 'announcement_published' && resourceId) {
    const announcement = await db.announcement.findFirst({
      where: { id: resourceId, church_id: churchId, published_at: { not: null }, deleted_at: null },
      select: { title: true },
    })
    if (!announcement) return null
    return {
      title: `New announcement from ${church.name}`,
      body: announcement.title,
      churchName: church.name,
      churchSlug: church.slug,
    }
  }
  if (type === 'event_reminder' && resourceId) {
    const event = await db.event.findFirst({
      where: { id: resourceId, church_id: churchId },
      select: { title: true },
    })
    if (!event) return null
    return {
      title: `Upcoming at ${church.name}`,
      body: event.title,
      churchName: church.name,
      churchSlug: church.slug,
    }
  }
  if (type === 'donation_reminder') {
    return {
      title: `Support ${church.name}`,
      body: 'Your giving keeps this ministry going.',
      churchName: church.name,
      churchSlug: church.slug,
    }
  }
  return null
}

/** AA-1 — replay must return the stored ack, never a synthetic empty one. */
export const GET_CHECK_IN_ACK = async ({ id, userId }: { id: string; userId: string }) => {
  const row = await db.checkIn.findFirst({ where: { id, user_id: userId } })
  return row
    ? {
        id: row.id,
        churchId: row.church_id,
        occurredAt: row.occurred_at.toISOString(),
        localDate: row.local_date.toISOString().slice(0, 10),
      }
    : null
}
