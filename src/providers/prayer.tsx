import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import { auditPayload } from '@/utils/audit'
import { hashContent } from '@/utils/hash'
import { mapVersion, PrayerListQuery, PrayerOutput, PrayerVersionOutput } from '@/models/prayer'

/*
 * Prayer content adapter (Tasks 21/22/25).
 *
 * Discipline: every read is scoped by a resolved `churchIds` set (count AND
 * row). Creates/states are transactional — the business row, version snapshots,
 * pointer updates, outbox job and audit commit atomically.
 *
 * Prayer.version is the concurrency token for every state transition; a write
 * that no longer matches returns 409 STALE_VERSION.
 */

const toIds = (churchIds: Set<string>) => Array.from(churchIds)
const stale = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'STALE_VERSION',
    details: 'This prayer has changed. Refresh and try again.',
  })
const notFound = () =>
  new GeneralError({
    code: 404,
    error: 'NOT_FOUND',
    error_code: 'RESOURCE_NOT_FOUND',
    details: 'Prayer not found.',
  })

type VersionRow = {
  id: string
  version_number: number
  pastor_id: string
  title: string
  introduction: string | null
  body: string
  language_code: string
  text_hash: string
  approved_by: string | null
  approved_at: Date | null
  selected_audio_id: string | null
  created_at: Date
}

const mapPrayer = (
  p: {
    id: string
    church_id: string
    version: number
    created_at: Date
    current_version_id: string | null
    published_version_id: string | null
    scheduled_version_id: string | null
    scheduled_at: Date | null
    published_at: Date | null
  },
  current: VersionRow | null,
): PrayerOutput => ({
  id: p.id,
  churchId: p.church_id,
  version: p.version,
  createdAt: p.created_at.toISOString(),
  current: current ? mapVersion(current) : null,
  published:
    p.published_version_id && p.published_at
      ? { prayerVersionId: p.published_version_id, publishedAt: p.published_at.toISOString() }
      : null,
  scheduled:
    p.scheduled_version_id && p.scheduled_at
      ? { prayerVersionId: p.scheduled_version_id, scheduledAt: p.scheduled_at.toISOString() }
      : null,
  textApproved: Boolean(current?.approved_at),
})

/** Content hash for the immutable text payload. */
export const TEXT_HASH = (input: { title: string; introduction: string | null; body: string }) =>
  hashContent(`${input.title}\n${input.introduction ?? ''}\n${input.body}`)

/** GET_CURRENT_VERSION_NUMBER: fetch a scoped version row by id. */
export const GET_VERSION = async ({
  churchIds,
  prayerId,
  versionId,
}: {
  churchIds: Set<string>
  prayerId: string
  versionId: string
}): Promise<{
  prayer: { id: string; version: number; current_version_id: string | null }
  version: VersionRow
} | null> => {
  const ids = toIds(churchIds)
  if (ids.length === 0) return null
  const prayer = await db.prayer.findFirst({
    where: { id: prayerId, church_id: { in: ids } },
    select: { id: true, version: true, current_version_id: true },
  })
  if (!prayer) return null
  const version = await db.prayerVersion.findFirst({
    where: { id: versionId, prayer_id: prayerId },
    select: {
      id: true,
      version_number: true,
      pastor_id: true,
      title: true,
      introduction: true,
      body: true,
      language_code: true,
      text_hash: true,
      approved_by: true,
      approved_at: true,
      selected_audio_id: true,
      created_at: true,
    },
  })
  if (!version) return null
  return { prayer, version }
}

export const GET_PRAYER = async ({
  churchIds,
  prayerId,
}: {
  churchIds: Set<string>
  prayerId: string
}): Promise<PrayerOutput | null> => {
  const ids = toIds(churchIds)
  if (ids.length === 0) return null
  const p = await db.prayer.findFirst({
    where: { id: prayerId, church_id: { in: ids } },
    select: {
      id: true,
      church_id: true,
      version: true,
      created_at: true,
      current_version_id: true,
      published_version_id: true,
      scheduled_version_id: true,
      scheduled_at: true,
      published_at: true,
    },
  })
  if (!p) return null
  let current: VersionRow | null = null
  if (p.current_version_id) {
    current = await db.prayerVersion.findFirst({
      where: { id: p.current_version_id },
      select: {
        id: true,
        version_number: true,
        pastor_id: true,
        title: true,
        introduction: true,
        body: true,
        language_code: true,
        text_hash: true,
        approved_by: true,
        approved_at: true,
        selected_audio_id: true,
        created_at: true,
      },
    })
  }
  return mapPrayer(p, current)
}

export const LIST_PRAYERS = async ({
  churchIds,
  query,
}: {
  churchIds: Set<string>
  query: PrayerListQuery
}): Promise<{ result: PrayerOutput[]; total: number }> => {
  const ids = toIds(churchIds)
  if (ids.length === 0) return { result: [], total: 0 }
  let idFilter: string[] | undefined
  if (query.search) {
    const matched = await db.prayerVersion.findMany({
      where: {
        prayer: { church_id: { in: ids } },
        title: { contains: query.search, mode: 'insensitive' },
      },
      select: { prayer_id: true },
    })
    idFilter = Array.from(new Set(matched.map((m) => m.prayer_id)))
    if (idFilter.length === 0) return { result: [], total: 0 }
  }
  const where: Prisma.PrayerWhereInput = {
    church_id: { in: ids },
    ...(idFilter ? { id: { in: idFilter } } : {}),
  }
  const orderByMap: Record<string, Prisma.PrayerOrderByWithRelationInput[]> = {
    created_at: [{ created_at: query.order_direction }, { id: 'asc' }],
    published_at: [{ published_at: query.order_direction }, { id: 'asc' }],
  }
  const [total, rows] = await db.$transaction([
    db.prayer.count({ where }),
    db.prayer.findMany({
      where,
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      orderBy: orderByMap[query.order_by],
      select: {
        id: true,
        church_id: true,
        version: true,
        created_at: true,
        current_version_id: true,
        published_version_id: true,
        scheduled_version_id: true,
        scheduled_at: true,
        published_at: true,
      },
    }),
  ])
  const currentIds = rows.map((r) => r.current_version_id).filter((x): x is string => Boolean(x))
  const versions = currentIds.length
    ? await db.prayerVersion.findMany({ where: { id: { in: currentIds } } })
    : []
  const versionById = new Map(versions.map((v) => [v.id, v]))
  const result = rows.map((r) =>
    mapPrayer(
      r,
      r.current_version_id ? ((versionById.get(r.current_version_id) as VersionRow) ?? null) : null,
    ),
  )
  return { result, total }
}

/** Base create (used inside the create transaction). */
export const CREATE_PRAYER = (
  data: Prisma.PrayerUncheckedCreateInput,
  tx: Prisma.TransactionClient = db,
) => tx.prayer.create({ data })

/** Base version create (used inside transactions). */
export const CREATE_PRAYER_VERSION = (
  data: Prisma.PrayerVersionUncheckedCreateInput,
  tx: Prisma.TransactionClient = db,
) => tx.prayerVersion.create({ data })

export const GET_PRAYER_VERSION_COUNT = async (
  prayerId: string,
  tx: Prisma.TransactionClient = db,
): Promise<number> => tx.prayerVersion.count({ where: { prayer_id: prayerId } })

/** Atomically create the Prayer + initial immutable version + set pointer. */
export const CREATE_PRAYER_WITH_VERSION = async ({
  churchId,
  data,
  actorId,
  requestId,
}: {
  churchId: string
  data: {
    pastorId: string
    title: string
    introduction: string | null
    body: string
    languageCode: string
  }
  actorId: string
  requestId: string
}): Promise<PrayerOutput> => {
  const textHash = TEXT_HASH(data)
  return db.$transaction(async (tx) => {
    const prayer = await tx.prayer.create({
      data: { church_id: churchId, created_by: actorId },
    })
    const version = await tx.prayerVersion.create({
      data: {
        prayer_id: prayer.id,
        version_number: 1,
        pastor_id: data.pastorId,
        title: data.title,
        introduction: data.introduction,
        body: data.body,
        language_code: data.languageCode,
        text_hash: textHash,
      },
    })
    const updated = await tx.prayer.update({
      where: { id: prayer.id },
      data: { current_version_id: version.id, version: 1, updated_at: new Date() },
    })
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        churchId,
        action: 'prayer.create',
        resourceType: 'prayer',
        resourceId: prayer.id,
        outcome: 'success',
        requestId,
      }),
    })
    return mapPrayer(updated, version)
  })
}

/** PATCH: create a NEW immutable snapshot and repoint current, never editing an approved one. */
export const CREATE_VERSION_SNAPSHOT = async ({
  churchIds,
  prayerId,
  expectedVersion,
  data,
  actorId,
  requestId,
}: {
  churchIds: Set<string>
  prayerId: string
  expectedVersion: number
  data: {
    pastorId: string
    title: string
    introduction: string | null
    body: string
    languageCode: string
  }
  actorId: string
  requestId: string
}): Promise<PrayerOutput> => {
  const churchId = toIds(churchIds)[0]
  if (!churchId) throw notFound()
  const textHash = TEXT_HASH(data)
  return db.$transaction(async (tx) => {
    const bumped = await tx.prayer.updateMany({
      where: { id: prayerId, church_id: churchId, version: expectedVersion },
      data: { version: { increment: 1 }, updated_at: new Date() },
    })
    if (bumped.count === 0) throw stale()
    const nextNumber =
      (
        await tx.prayerVersion.aggregate({
          where: { prayer_id: prayerId },
          _max: { version_number: true },
        })
      )._max.version_number ?? 0
    const version = await tx.prayerVersion.create({
      data: {
        prayer_id: prayerId,
        version_number: nextNumber + 1,
        pastor_id: data.pastorId,
        title: data.title,
        introduction: data.introduction,
        body: data.body,
        language_code: data.languageCode,
        text_hash: textHash,
      },
    })
    const updated = await tx.prayer.update({
      where: { id: prayerId },
      data: { current_version_id: version.id },
      select: {
        id: true,
        church_id: true,
        version: true,
        created_at: true,
        current_version_id: true,
        published_version_id: true,
        scheduled_version_id: true,
        scheduled_at: true,
        published_at: true,
      },
    })
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        churchId,
        action: 'prayer.version.create',
        resourceType: 'prayer',
        resourceId: prayerId,
        outcome: 'success',
        requestId,
      }),
    })
    return mapPrayer(updated, version)
  })
}

/** approve-text: mark the current snapshot approved. */
export const APPROVE_TEXT = async ({
  churchIds,
  prayerId,
  expectedVersion,
  prayerVersionId,
  actorId,
  requestId,
}: {
  churchIds: Set<string>
  prayerId: string
  expectedVersion: number
  prayerVersionId: string
  actorId: string
  requestId: string
}): Promise<PrayerVersionOutput> => {
  const churchId = toIds(churchIds)[0]
  if (!churchId) throw notFound()
  return db.$transaction(async (tx) => {
    const bumped = await tx.prayer.updateMany({
      where: { id: prayerId, church_id: churchId, version: expectedVersion },
      data: { version: { increment: 1 }, updated_at: new Date() },
    })
    if (bumped.count === 0) throw stale()
    const now = new Date()
    const updated = await tx.prayerVersion
      .update({
        where: { id: prayerVersionId, prayer_id: prayerId },
        data: { approved_by: actorId, approved_at: now },
        select: {
          id: true,
          version_number: true,
          pastor_id: true,
          title: true,
          introduction: true,
          body: true,
          language_code: true,
          text_hash: true,
          approved_by: true,
          approved_at: true,
          selected_audio_id: true,
          created_at: true,
        },
      })
      .catch((e) => {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw stale()
        throw e
      })
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        churchId,
        action: 'prayer.text.approve',
        resourceType: 'prayer',
        resourceId: prayerId,
        outcome: 'success',
        requestId,
      }),
    })
    return mapVersion(updated)
  })
}

/** schedule: set scheduled pointer + time (both-or-null) after bumping version. */
export const SCHEDULE_PRAYER = async ({
  churchIds,
  prayerId,
  expectedVersion,
  prayerVersionId,
  scheduledAt,
  actorId,
  requestId,
}: {
  churchIds: Set<string>
  prayerId: string
  expectedVersion: number
  prayerVersionId: string
  scheduledAt: Date | null
  actorId: string
  requestId: string
}): Promise<PrayerOutput> => {
  const churchId = toIds(churchIds)[0]
  if (!churchId) throw notFound()
  return db.$transaction(async (tx) => {
    const bumped = await tx.prayer.updateMany({
      where: { id: prayerId, church_id: churchId, version: expectedVersion },
      data: { version: { increment: 1 }, updated_at: new Date() },
    })
    if (bumped.count === 0) throw stale()
    const updated = await tx.prayer.update({
      where: { id: prayerId },
      data: {
        scheduled_version_id: scheduledAt ? prayerVersionId : null,
        scheduled_at: scheduledAt,
      },
      ...prayerSelect,
    })
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        churchId,
        action: 'prayer.schedule',
        resourceType: 'prayer',
        resourceId: prayerId,
        outcome: 'success',
        requestId,
      }),
    })
    const current = updated.current_version_id
      ? await tx.prayerVersion.findFirst({
          where: { id: updated.current_version_id },
          select: versionFields,
        })
      : null
    return mapPrayer(updated, current)
  })
}

const versionFields = {
  id: true,
  version_number: true,
  pastor_id: true,
  title: true,
  introduction: true,
  body: true,
  language_code: true,
  text_hash: true,
  approved_by: true,
  approved_at: true,
  selected_audio_id: true,
  created_at: true,
} as const

const prayerSelect = {
  select: {
    id: true,
    church_id: true,
    version: true,
    created_at: true,
    current_version_id: true,
    published_version_id: true,
    scheduled_version_id: true,
    scheduled_at: true,
    published_at: true,
  },
}

/** publish: set published pointer + now, clear schedule, enqueue prayer.publish, one tx. */
export const PUBLISH_PRAYER = async ({
  churchIds,
  prayerId,
  expectedVersion,
  prayerVersionId,
  actorId,
  requestId,
}: {
  churchIds: Set<string>
  prayerId: string
  expectedVersion: number
  prayerVersionId: string
  actorId: string
  requestId: string
}): Promise<PrayerOutput> => {
  const churchId = toIds(churchIds)[0]
  if (!churchId) throw notFound()
  const now = new Date()
  return db.$transaction(async (tx) => {
    const bumped = await tx.prayer.updateMany({
      where: { id: prayerId, church_id: churchId, version: expectedVersion },
      data: { version: { increment: 1 }, updated_at: new Date() },
    })
    if (bumped.count === 0) throw stale()
    const updated = await tx.prayer.update({
      where: { id: prayerId },
      data: {
        published_version_id: prayerVersionId,
        published_at: now,
        scheduled_version_id: null,
        scheduled_at: null,
      },
      ...prayerSelect,
    })
    await tx.outboxJob.create({
      data: {
        kind: 'prayer.publish',
        dedupe_key: `prayer.publish:${prayerId}:${prayerVersionId}`,
        resource_id: prayerId,
        payload: { prayerVersionId, churchId },
        available_at: now,
      },
    })
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        churchId,
        action: 'prayer.publish',
        resourceType: 'prayer',
        resourceId: prayerId,
        outcome: 'success',
        requestId,
      }),
    })
    const current = updated.current_version_id
      ? await tx.prayerVersion.findFirst({
          where: { id: updated.current_version_id },
          select: versionFields,
        })
      : null
    return mapPrayer(updated, current)
  })
}
