import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import { auditPayload } from '@/utils/audit'
import { ANNOUNCEMENT_STATUS } from '@/utils/constant'
import { ENQUEUE_NOTIFICATION } from './notification'
import {
  AnnouncementInput,
  AnnouncementListItem,
  AnnouncementListQuery,
  AnnouncementOutput,
  mapAnnouncement,
} from '@/models/announcement'

/*
 * Announcement adapter (Task 27, D12 resolved: title + body + immediate
 * publish, no arbitrary schedule). Reads scoped by `churchIds`; publish sets
 * published_at = now. version is the stale guard.
 */

const toIds = (churchIds: Set<string>) => Array.from(churchIds)
const stale = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'STALE_VERSION',
    details: 'This announcement has changed. Refresh and try again.',
  })
const notFound = () =>
  new GeneralError({
    code: 404,
    error: 'NOT_FOUND',
    error_code: 'RESOURCE_NOT_FOUND',
    details: 'Announcement not found.',
  })

export const LIST_ANNOUNCEMENTS = async ({
  churchIds,
  query,
}: {
  churchIds: Set<string>
  query: AnnouncementListQuery
}): Promise<{ result: AnnouncementListItem[]; total: number }> => {
  const ids = toIds(churchIds)
  const publicationFilters: Prisma.AnnouncementWhereInput[] = []
  if (query.status === ANNOUNCEMENT_STATUS.DRAFT) publicationFilters.push({ published_at: null })
  if (query.status === ANNOUNCEMENT_STATUS.PUBLISHED)
    publicationFilters.push({ published_at: { not: null } })
  if (query.published_from || query.published_to) {
    publicationFilters.push({
      published_at: {
        ...(query.published_from ? { gte: new Date(query.published_from) } : {}),
        ...(query.published_to ? { lte: new Date(query.published_to) } : {}),
      },
    })
  }
  const where: Prisma.AnnouncementWhereInput = {
    church_id: { in: ids },
    deleted_at: null,
    ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    ...(publicationFilters.length ? { AND: publicationFilters } : {}),
  }
  // ponytail: no index on created_at, so cross-church (central) sorts scan every row;
  // add @@index([created_at]) to Announcement once the table nears ~100k rows.
  const orderByMap: Record<string, Prisma.AnnouncementOrderByWithRelationInput[]> = {
    created_at: [{ created_at: query.order_direction }, { id: 'asc' }],
    title: [{ title: query.order_direction }, { id: 'asc' }],
    published_at: [{ published_at: query.order_direction }, { id: 'asc' }],
  }
  const [total, rows] = await db.$transaction([
    db.announcement.count({ where }),
    db.announcement.findMany({
      where,
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      orderBy: orderByMap[query.order_by],
      include: { church: { select: { name: true, timezone: true } } },
    }),
  ])
  return { result: rows.map((r) => ({ ...mapAnnouncement(r), church: r.church })), total }
}

export const GET_ANNOUNCEMENT = async ({
  churchId,
  churchIds,
  announcementId,
}: {
  churchId: string
  churchIds: Set<string>
  announcementId: string
}): Promise<AnnouncementOutput | null> => {
  if (!churchIds.has(churchId)) return null
  const row = await db.announcement.findFirst({
    where: { id: announcementId, church_id: churchId, deleted_at: null },
  })
  return row ? mapAnnouncement(row) : null
}

/** Single announcement by id within a scope set (central detail; church comes from the row). */
export const GET_ANNOUNCEMENT_IN_SCOPE = async ({
  churchIds,
  announcementId,
}: {
  churchIds: Set<string>
  announcementId: string
}): Promise<AnnouncementListItem | null> => {
  const row = await db.announcement.findFirst({
    where: { id: announcementId, church_id: { in: toIds(churchIds) }, deleted_at: null },
    include: { church: { select: { name: true, timezone: true } } },
  })
  return row ? { ...mapAnnouncement(row), church: row.church } : null
}

export const CREATE_ANNOUNCEMENT = async ({
  churchId,
  data,
  actorId,
  requestId,
}: {
  churchId: string
  data: AnnouncementInput
  actorId: string
  requestId: string
}): Promise<AnnouncementOutput> => {
  const row = await db.announcement.create({
    data: { church_id: churchId, title: data.title, body: data.body },
  })
  await db.auditLog.create({
    data: auditPayload({
      actorId,
      churchId,
      action: 'announcement.create',
      resourceType: 'announcement',
      resourceId: row.id,
      outcome: 'success',
      requestId,
    }),
  })
  return mapAnnouncement(row)
}

export const UPDATE_ANNOUNCEMENT = async ({
  churchId,
  churchIds,
  announcementId,
  expectedVersion,
  data,
  actorId,
  requestId,
}: {
  churchId: string
  churchIds: Set<string>
  announcementId: string
  expectedVersion: number
  data: AnnouncementInput
  actorId: string
  requestId: string
}): Promise<AnnouncementOutput> => {
  if (!churchIds.has(churchId)) throw notFound()
  return db.$transaction(async (tx) => {
    const updated = await tx.announcement.updateMany({
      where: {
        id: announcementId,
        church_id: churchId,
        version: expectedVersion,
        deleted_at: null,
      },
      data: {
        title: data.title,
        body: data.body,
        // An edit returns the announcement to Draft so the change can be
        // reviewed before it goes live again (publish/unpublish is separate).
        published_at: null,
        version: { increment: 1 },
        updated_at: new Date(),
      },
    })
    if (updated.count === 0) throw stale()
    const row = await tx.announcement.findFirst({
      where: { id: announcementId, church_id: churchId },
    })
    if (!row) throw stale()
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        churchId,
        action: 'announcement.update',
        resourceType: 'announcement',
        resourceId: announcementId,
        outcome: 'success',
        requestId,
      }),
    })
    return mapAnnouncement(row)
  })
}

export const PUBLISH_ANNOUNCEMENT = async ({
  churchId,
  churchIds,
  announcementId,
  expectedVersion,
  actorId,
  requestId,
}: {
  churchId: string
  churchIds: Set<string>
  announcementId: string
  expectedVersion: number
  actorId: string
  requestId: string
}): Promise<AnnouncementOutput> => {
  if (!churchIds.has(churchId)) throw notFound()
  return db.$transaction(async (tx) => {
    const now = new Date()
    const updated = await tx.announcement.updateMany({
      where: {
        id: announcementId,
        church_id: churchId,
        version: expectedVersion,
        published_at: null,
        deleted_at: null,
      },
      data: { published_at: now, version: { increment: 1 }, updated_at: now },
    })
    if (updated.count === 0) throw stale()
    const row = await tx.announcement.findFirst({
      where: { id: announcementId, church_id: churchId },
    })
    if (!row) throw stale()
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        churchId,
        action: 'announcement.publish',
        resourceType: 'announcement',
        resourceId: announcementId,
        outcome: 'success',
        requestId,
      }),
    })
    // Queue the announcement_published notification in the same transaction as
    // the publish, so a published announcement is never silently unnotified.
    // The trigger name must match the notification rule / sender's trigger map.
    // Dedupe key = the version that just went live (one notification per publish).
    await ENQUEUE_NOTIFICATION(
      {
        type: 'announcement_published',
        resourceId: announcementId,
        churchId,
        dedupeKeySuffix: `${announcementId}:${expectedVersion + 1}`,
      },
      tx,
    )
    return mapAnnouncement(row)
  })
}

export const UNPUBLISH_ANNOUNCEMENT = async ({
  churchId,
  churchIds,
  announcementId,
  expectedVersion,
  actorId,
  requestId,
}: {
  churchId: string
  churchIds: Set<string>
  announcementId: string
  expectedVersion: number
  actorId: string
  requestId: string
}): Promise<AnnouncementOutput> => {
  if (!churchIds.has(churchId)) throw notFound()
  return db.$transaction(async (tx) => {
    const updated = await tx.announcement.updateMany({
      where: {
        id: announcementId,
        church_id: churchId,
        version: expectedVersion,
        published_at: { not: null },
        deleted_at: null,
      },
      data: { published_at: null, version: { increment: 1 }, updated_at: new Date() },
    })
    if (updated.count === 0) throw stale()
    const row = await tx.announcement.findFirst({
      where: { id: announcementId, church_id: churchId },
    })
    if (!row) throw stale()
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        churchId,
        action: 'announcement.unpublish',
        resourceType: 'announcement',
        resourceId: announcementId,
        outcome: 'success',
        requestId,
      }),
    })
    return mapAnnouncement(row)
  })
}

/** Soft delete: hides the row from every admin and mobile read; the row and audit trail remain. */
export const DELETE_ANNOUNCEMENT = async ({
  churchId,
  churchIds,
  announcementId,
  expectedVersion,
  actorId,
  requestId,
}: {
  churchId: string
  churchIds: Set<string>
  announcementId: string
  expectedVersion: number
  actorId: string
  requestId: string
}): Promise<void> => {
  if (!churchIds.has(churchId)) throw notFound()
  await db.$transaction(async (tx) => {
    const now = new Date()
    const deleted = await tx.announcement.updateMany({
      where: {
        id: announcementId,
        church_id: churchId,
        version: expectedVersion,
        deleted_at: null,
      },
      data: { deleted_at: now, version: { increment: 1 }, updated_at: now },
    })
    if (deleted.count === 0) throw stale()
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        churchId,
        action: 'announcement.delete',
        resourceType: 'announcement',
        resourceId: announcementId,
        outcome: 'success',
        requestId,
      }),
    })
  })
}
