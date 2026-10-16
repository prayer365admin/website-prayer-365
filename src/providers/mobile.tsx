import { EventCategory, Prisma, RequestKind } from '@prisma/client'
import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import { auditPayload } from '@/utils/audit'
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
  MobilePrayerListQuery,
  MobileDiaconalProgram,
  MobilePublicAnnouncement,
  MobilePublicChurch,
  MobilePublicEvent,
  MobilePublishedPrayer,
  MobileRequestInput,
} from '@/models/mobile'

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

const notFoundChurch = () =>
  new GeneralError({
    code: 404,
    error: 'NOT_FOUND',
    error_code: 'RESOURCE_NOT_FOUND',
    details: 'Church not found or not available.',
  })

/** Church must exist AND be APPROVED for any mobile read/write. */
const activeChurchWhere = (id: string): Prisma.ChurchWhereInput => ({
  id,
  status: APPROVED,
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
    name: string
    denomination: string | null
    address: unknown
    cover_asset_id: string | null
    latitude: unknown
    longitude: unknown
    description?: string | null
    accessibility?: string | string[] | null
    sanctuary_hours?: string | null
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
  if (c.description) summary.description = c.description
  if (c.accessibility) {
    summary.accessibility = Array.isArray(c.accessibility)
      ? c.accessibility
      : c.accessibility
          .split(' • ')
          .map((s) => s.trim())
          .filter(Boolean)
  }
  if (c.sanctuary_hours) summary.sanctuaryHours = c.sanctuary_hours
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

export function isOpenNow(
  timezone: string,
  serviceTimes: Array<{ weekday: number; local_time: Date }>,
  now: Date,
): boolean {
  if (!serviceTimes || serviceTimes.length === 0) return false

  let parts: Intl.DateTimeFormatPart[]
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    })
    parts = fmt.formatToParts(now)
  } catch {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    })
    parts = fmt.formatToParts(now)
  }

  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value?.replace('.', '')
  const currentWeekday = weekdayStr ? WEEKDAY_MAP[weekdayStr] : undefined
  if (!currentWeekday) return false

  const rawHour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const hour = rawHour === 24 ? 0 : rawHour
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  const nowMinutes = hour * 60 + minute

  for (const st of serviceTimes) {
    if (st.weekday !== currentWeekday) continue
    const dObj = st.local_time instanceof Date ? st.local_time : new Date(st.local_time)
    if (isNaN(dObj.getTime())) continue
    const timeStr = dObj.toISOString().slice(11, 16)
    const [stH, stM] = timeStr.split(':').map(Number)
    if (isNaN(stH) || isNaN(stM)) continue
    const stMinutes = (stH === 24 ? 0 : stH) * 60 + stM
    const diff = Math.abs(nowMinutes - stMinutes)
    const circularDiff = Math.min(diff, 1440 - diff)
    if (circularDiff <= 120) return true
  }

  return false
}

const churchListWhere = (query: MobileChurchListQuery): Prisma.ChurchWhereInput => ({
  status: APPROVED,
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
    accessibility: string | null
    cover_asset_id: string | null
    churchLanguages: { language_code: string }[]
    serviceTimes: {
      weekday: number
      local_time: Date
      label: string | null
      language_code: string | null
    }[]
    sanctuary_hours?: string | null
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
    diaconal_programs?: unknown
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
    accessibility: c.accessibility,
    coverAssetId: c.cover_asset_id,
    languageCodes: c.churchLanguages.map((l) => l.language_code),
    serviceTimes: c.serviceTimes.map((s) => ({
      weekday: s.weekday,
      // HH:MM church wall clock (Europe/Tallinn etc. via church.timezone)
      localTime: s.local_time.toISOString().slice(11, 16),
      label: s.label,
      languageCode: s.language_code,
    })),
    distanceKm,
    pastorName: c.pastors?.[0]?.pastor?.name ?? null,
    pastorRole: c.pastors?.[0]?.pastoral_role ?? null,
    sanctuaryHours: c.sanctuary_hours ?? null,
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
    diaconalPrograms: Array.isArray(c.diaconal_programs)
      ? (c.diaconal_programs as MobileDiaconalProgram[])
      : [],
  }
}

// ---------------------------------------------------------------------------
// Task 39 — discovery / public profile
// ---------------------------------------------------------------------------

export const LIST_PUBLIC_CHURCHES = async ({
  query,
}: {
  query: MobileChurchListQuery
}): Promise<{ result: MobileChurchSummary[]; total: number }> => {
  const where = churchListWhere(query)
  const inMemory =
    query.radius_km !== undefined ||
    query.open_now === true ||
    (query.latitude !== undefined && query.longitude !== undefined)

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
          name: true,
          denomination: true,
          address: true,
          cover_asset_id: true,
          latitude: true,
          longitude: true,
          description: true,
          accessibility: true,
          sanctuary_hours: true,
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
      result: await Promise.all(
        rows.map((r) => withCover(toSummary(r, query.latitude, query.longitude))),
      ),
      total,
    }
  }

  const rows = await db.church.findMany({
    where,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      denomination: true,
      address: true,
      cover_asset_id: true,
      latitude: true,
      longitude: true,
      description: true,
      accessibility: true,
      sanctuary_hours: true,
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

  if (query.open_now === true) {
    const now = new Date()
    pairs = pairs.filter((p) =>
      isOpenNow((p.row as { timezone?: string }).timezone ?? 'UTC', p.row.serviceTimes ?? [], now),
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
  const result = await Promise.all(paged.map((p) => withCover(p.summary)))

  return { result, total }
}

export const GET_PUBLIC_CHURCH = async ({
  churchId,
  lat,
  lng,
}: {
  churchId: string
  lat?: number
  lng?: number
}): Promise<MobilePublicChurch | null> => {
  const row = await db.church.findFirst({
    where: activeChurchWhere(churchId),
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
        where: activeChurchWhere(mainChurchId),
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
          name: true,
          address: true,
          cover_asset_id: true,
          status: true,
        },
      },
    },
  })
  return Promise.all(
    rows
      .filter((r) => r.church.status === APPROVED)
      .map((r) =>
        withCover({
          churchId: r.church.id,
          churchName: r.church.name,
          city: (r.church.address as { city?: string } | null)?.city ?? null,
          coverAssetId: r.church.cover_asset_id,
          isMain: r.is_main,
          isFollowed: r.is_followed,
        }),
      ),
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
    where: activeChurchWhere(churchId),
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
    },
    orderBy: [{ is_main: 'desc' }],
  })
  const approved = rows.filter(
    (r) =>
      // approved enforced by where; both flags default relationship if main or followed
      r.is_main || r.is_followed,
  )
  const mainRow = approved.find((r) => r.is_main) ?? approved[0]
  let mainChurch: MobilePublicChurch | null = null
  let latestPrayers: MobilePublishedPrayer[] = []
  let latestEvents: MobilePublicEvent[] = []
  let latestAnnouncements: MobilePublicAnnouncement[] = []
  if (mainRow) {
    mainChurch = await GET_PUBLIC_CHURCH({ churchId: mainRow.church_id })
    if (mainChurch) {
      latestPrayers = (
        await LIST_PUBLISHED_PRAYERS({ churchId: mainRow.church_id, query: { page: 1, limit: 3 } })
      ).result
      latestEvents = (
        await LIST_PUBLIC_EVENTS({ churchId: mainRow.church_id, query: { page: 1, limit: 3 } })
      ).result
      latestAnnouncements = (
        await LIST_PUBLIC_ANNOUNCEMENTS({
          churchId: mainRow.church_id,
          query: { page: 1, limit: 3 },
        })
      ).result
    }
  }
  const followedIds = approved.filter((r) => r.is_followed).map((r) => r.church_id)
  const followed = followedIds.length
    ? await db.church.findMany({
        where: { id: { in: followedIds }, status: APPROVED },
        select: {
          id: true,
          name: true,
          denomination: true,
          address: true,
          cover_asset_id: true,
          latitude: true,
          longitude: true,
          sanctuary_hours: true,
        },
      })
    : []
  return {
    mainChurch,
    followedChurches: await Promise.all(followed.map((f) => withCover(toSummary(f)))),
    latestPrayers,
    latestEvents,
    latestAnnouncements,
  }
}

// ---------------------------------------------------------------------------
// Task 41 — published prayers / approved audio
// ---------------------------------------------------------------------------

const publishedPrayerWhere = (churchId: string): Prisma.PrayerWhereInput => ({
  church_id: churchId,
  church: { status: APPROVED },
  published_version_id: { not: null },
  published_at: { not: null },
})

const mapPublishedPrayer = (p: {
  id: string
  church_id: string
  published_at: Date | null
  version: {
    id: string
    version_number: number
    pastor_id: string
    title: string
    introduction: string | null
    body: string
    language_code: string
    selected_audio: {
      id: string
      status: string
      approved_at: Date | null
      approved_by: string | null
      asset: { id: string; object_key: string } | null
    } | null
  } | null
}): MobilePublishedPrayer | null => {
  if (!p.version) return null
  const audio = p.version.selected_audio
  const approved = audio && audio.status === 'APPROVED' && audio.asset
  return {
    id: p.id,
    churchId: p.church_id,
    publishedAt: toIso(p.published_at) ?? '',
    version: {
      prayerVersionId: p.version.id,
      versionNumber: p.version.version_number,
      pastorId: p.version.pastor_id,
      title: p.version.title,
      introduction: p.version.introduction,
      body: p.version.body,
      languageCode: p.version.language_code,
    },
    audio: approved
      ? {
          prayerAudioId: audio.id,
          assetId: audio.asset!.id,
          assetKey: audio.asset!.object_key,
          approvedAt: toIso(audio.approved_at) ?? '',
        }
      : null,
  }
}

export const LIST_PUBLISHED_PRAYERS = async ({
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
      select: { id: true, church_id: true, published_at: true, published_version_id: true },
    }),
  ])
  const versionIds = rows.map((r) => r.published_version_id).filter((v): v is string => Boolean(v))
  const versions = versionIds.length
    ? await db.prayerVersion.findMany({
        where: { id: { in: versionIds } },
        include: {
          selected_audio: { include: { asset: { select: { id: true, object_key: true } } } },
        },
      })
    : []
  const versionById = new Map(versions.map((v) => [v.id, v]))
  const result = rows
    .map((r) =>
      mapPublishedPrayer({
        id: r.id,
        church_id: r.church_id,
        published_at: r.published_at,
        version: r.published_version_id
          ? ((versionById.get(r.published_version_id) as never) ?? null)
          : null,
      }),
    )
    .filter((x): x is MobilePublishedPrayer => Boolean(x))
  return { result, total }
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
      church_id: true,
      published_at: true,
      published_version_id: true,
    },
  })
  if (!p || !p.published_version_id) return null
  const version = await db.prayerVersion.findFirst({
    where: { id: p.published_version_id, prayer_id: p.id },
    include: {
      selected_audio: { include: { asset: { select: { id: true, object_key: true } } } },
    },
  })
  return mapPublishedPrayer({
    id: p.id,
    church_id: p.church_id,
    published_at: p.published_at,
    version: (version as never) ?? null,
  })
}

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

/** User's submissions to one church since `since` (submission rate limit). */
export const COUNT_RECENT_USER_REQUESTS = async ({
  churchId,
  userId,
  since,
  tx,
}: {
  churchId: string
  userId: string
  since: Date
  tx: Prisma.TransactionClient | null
}): Promise<number> => {
  const client: Prisma.TransactionClient = tx ?? (db as unknown as Prisma.TransactionClient)
  return client.request.count({
    where: { church_id: churchId, user_id: userId, created_at: { gte: since } },
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
    where: activeChurchWhere(churchId),
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
