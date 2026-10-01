import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import { AuditInput, auditPayload } from '@/utils/audit'
import { ChurchListQuery, ChurchOverview, ChurchProfileOutput } from '@/models/church'

/*
 * Church data adapter (Tasks 12/13). UPPER_SNAKE_CASE, single-responsibility.
 * Every read is scoped by a resolved `churchIds` set (count AND row) so a
 * caller can never observe a church outside their grant.
 */

const toIds = (churchIds: Set<string>) => Array.from(churchIds)

/** Paginated list of the caller's assigned churches, scoped by churchIds. */
export const GET_CHURCHES = async ({
  churchIds,
  query,
}: {
  churchIds: Set<string>
  query: ChurchListQuery
}): Promise<{ result: ChurchProfileOutput[]; total: number }> => {
  const ids = toIds(churchIds)
  const where: Prisma.ChurchWhereInput = {
    id: { in: ids },
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
  }
  const orderBy =
    query.order_by === 'name'
      ? [{ name: query.order_direction }, { id: 'asc' }]
      : [{ created_at: query.order_direction }, { id: 'asc' }]
  const [total, rows] = await db.$transaction([
    db.church.count({ where }),
    db.church.findMany({
      where,
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      orderBy: orderBy as Prisma.ChurchOrderByWithRelationInput[],
    }),
  ])
  const result = rows.map((r) => mapProfile(r, []))
  return { result, total }
}

/** Single editable profile, scoped by churchIds (must include the target). */
export const GET_CHURCH_PROFILE = async ({
  churchId,
  churchIds,
}: {
  churchId: string
  churchIds: Set<string>
}): Promise<ChurchProfileOutput | null> => {
  const ids = toIds(churchIds)
  if (ids.length === 0) return null
  const row = await db.church.findFirst({
    where: { AND: [{ id: churchId }, { id: { in: ids } }] },
    include: { churchLanguages: { select: { language_code: true } } },
  })
  if (!row) return null
  return mapProfile(
    row,
    row.churchLanguages.map((l) => l.language_code.trim()),
  )
}

const mapProfile = (
  row: {
    id: string
    name: string
    status: string
    timezone: string
    description: string | null
    denomination: string | null
    address: unknown
    latitude: unknown
    longitude: unknown
    contacts: unknown
    website: string | null
    social_links: unknown
    accessibility: string | null
    cover_asset_id: string | null
    version: number
  },
  languageCodes: string[],
): ChurchProfileOutput => {
  const lat = row.latitude as number | null
  const lng = row.longitude as number | null
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    description: row.description,
    denomination: row.denomination,
    address: row.address,
    coordinates:
      lat !== null && lng !== null ? { latitude: Number(lat), longitude: Number(lng) } : null,
    timezone: row.timezone,
    contacts: row.contacts,
    website: row.website,
    socialLinks: row.social_links,
    accessibility: row.accessibility,
    coverAssetId: row.cover_asset_id,
    languageCodes,
    version: row.version,
  }
}

/** Current concurrency version of a church in scope, for stale checks. */
export const GET_CHURCH_VERSION = async ({
  churchId,
  churchIds,
}: {
  churchId: string
  churchIds: Set<string>
}): Promise<number | null> => {
  const ids = toIds(churchIds)
  if (ids.length === 0) return null
  const row = await db.church.findFirst({
    where: { AND: [{ id: churchId }, { id: { in: ids } }] },
    select: { version: true },
  })
  return row ? row.version : null
}

/** Enabled language rows matching the requested codes (owned/available check). */
export const GET_AVAILABLE_LANGUAGE_CODES = async ({
  codes,
}: {
  codes: string[]
}): Promise<Set<string>> => {
  if (codes.length === 0) return new Set()
  const rows = await db.language.findMany({
    where: { code: { in: codes }, enabled: true },
    select: { code: true },
  })
  return new Set(rows.map((r) => r.code.trim()))
}

/** READY image asset belonging to this church (cover asset ownership check). */
export const GET_CHURCH_READY_IMAGE = async ({
  churchIds,
  assetId,
}: {
  churchIds: Set<string>
  assetId: string
}): Promise<{ id: string } | null> => {
  const ids = toIds(churchIds)
  if (ids.length === 0) return null
  return db.mediaAsset.findFirst({
    where: { id: assetId, church_id: { in: ids }, status: 'READY', purpose: 'IMAGE' },
    select: { id: true },
  })
}

/**
 * Profile update within a transaction referencing the expected version.
 * Throws 409 STALE_VERSION when the row changed since the client read it.
 * Languages are replaced wholesale inside the same transaction.
 */
export const UPDATE_CHURCH_PROFILE = async ({
  churchId,
  churchIds,
  expectedVersion,
  payload,
  languageCodes,
  requestId,
  actorId,
}: {
  churchId: string
  churchIds: Set<string>
  expectedVersion: number
  payload: Prisma.ChurchUncheckedUpdateInput
  languageCodes: string[]
  requestId: string
  actorId?: string | null
}): Promise<ChurchProfileOutput> => {
  const ids = toIds(churchIds)
  if (ids.length === 0)
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'RESOURCE_NOT_FOUND',
      details: 'Church not found.',
    })

  return db.$transaction(async (tx) => {
    const updated = await tx.church.updateMany({
      where: { AND: [{ id: churchId }, { id: { in: ids } }, { version: expectedVersion }] },
      data: { ...payload, version: { increment: 1 }, updated_at: new Date() },
    })
    if (updated.count === 0) {
      throw new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'STALE_VERSION',
        details: 'This church has changed. Refresh and try again.',
      })
    }
    await tx.churchLanguage.deleteMany({ where: { church_id: churchId } })
    if (languageCodes.length > 0) {
      await tx.churchLanguage.createMany({
        data: languageCodes.map((language_code) => ({ church_id: churchId, language_code })),
      })
    }
    await writeAuditTx(tx, {
      actorId,
      churchId,
      action: 'church.profile.update',
      resourceType: 'church',
      resourceId: churchId,
      outcome: 'success',
      requestId,
    })

    const row = await tx.church.findUnique({
      where: { id: churchId },
      include: { churchLanguages: { select: { language_code: true } } },
    })
    return mapProfile(
      row!,
      row!.churchLanguages.map((l) => l.language_code.trim()),
    )
  })
}

/** Overview aggregates scoped by churchIds; returns null when the church is out of scope. */
export const GET_CHURCH_OVERVIEW = async ({
  churchId,
  churchIds,
}: {
  churchId: string
  churchIds: Set<string>
}): Promise<ChurchOverview | null> => {
  const ids = toIds(churchIds)
  if (ids.length === 0) return null
  const church = await db.church.findFirst({
    where: { AND: [{ id: churchId }, { id: { in: ids } }] },
    select: { id: true, name: true, status: true, timezone: true, address: true, version: true },
  })
  if (!church) return null
  const [
    serviceTimeCount,
    pastorCount,
    prayerCount,
    eventCount,
    announcementCount,
    memberCount,
    mediaCount,
  ] = await db.$transaction([
    db.serviceTime.count({ where: { church_id: churchId } }),
    db.churchPastor.count({ where: { church_id: churchId } }),
    db.prayer.count({ where: { church_id: churchId } }),
    db.event.count({ where: { church_id: churchId } }),
    db.announcement.count({ where: { church_id: churchId } }),
    db.userChurch.count({ where: { church_id: churchId } }),
    db.mediaAsset.count({ where: { church_id: churchId } }),
  ])
  const agg: ChurchOverview['aggregates'] = {
    serviceTimeCount,
    pastorCount,
    prayerCount,
    eventCount,
    announcementCount,
    memberCount,
    mediaCount,
  }
  const city = (church.address as { city?: string } | null)?.city ?? null
  return {
    church: {
      id: church.id,
      name: church.name,
      status: church.status,
      timezone: church.timezone,
      city,
      version: church.version,
    },
    aggregates: agg,
  }
}

/** Request aggregates; only invoked when the caller has request access. */
export const GET_REQUEST_OVERVIEW = async ({
  churchIds,
  take = 5,
}: {
  churchIds: Set<string>
  take?: number
}): Promise<ChurchOverview['requests']> => {
  const ids = toIds(churchIds)
  if (ids.length === 0) return { total: 0, recent: [] }
  const where: Prisma.RequestWhereInput = { church_id: { in: ids } }
  const [total, recent] = await db.$transaction([
    db.request.count({ where }),
    db.request.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
      take,
      select: { id: true, kind: true, classification: true, created_at: true },
    }),
  ])
  return {
    total,
    recent: recent.map((r) => ({
      id: r.id,
      kind: r.kind,
      classification: r.classification,
      createdAt: r.created_at,
    })),
  }
}

type TxLike = {
  auditLog: { create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown> }
}

const writeAuditTx = async (
  tx: TxLike,
  input: Omit<AuditInput, 'requestId'> & { requestId: string },
) => {
  await tx.auditLog.create({ data: auditPayload(input) })
}
