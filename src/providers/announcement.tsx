import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import { auditPayload } from '@/utils/audit'
import {
  AnnouncementInput,
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
}): Promise<{ result: AnnouncementOutput[]; total: number }> => {
  const ids = toIds(churchIds)
  const where: Prisma.AnnouncementWhereInput = {
    church_id: { in: ids },
    ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
  }
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
    }),
  ])
  return { result: rows.map(mapAnnouncement), total }
}

export const GET_ANNOUNCEMENT = async ({
  churchIds,
  announcementId,
}: {
  churchIds: Set<string>
  announcementId: string
}): Promise<AnnouncementOutput | null> => {
  const ids = toIds(churchIds)
  if (ids.length === 0) return null
  const row = await db.announcement.findFirst({
    where: { id: announcementId, church_id: { in: ids } },
  })
  return row ? mapAnnouncement(row) : null
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
  churchIds,
  announcementId,
  expectedVersion,
  data,
  actorId,
  requestId,
}: {
  churchIds: Set<string>
  announcementId: string
  expectedVersion: number
  data: AnnouncementInput
  actorId: string
  requestId: string
}): Promise<AnnouncementOutput> => {
  const churchId = toIds(churchIds)[0]
  if (!churchId) throw notFound()
  return db.$transaction(async (tx) => {
    const updated = await tx.announcement.updateMany({
      where: { id: announcementId, church_id: churchId, version: expectedVersion },
      data: {
        title: data.title,
        body: data.body,
        version: { increment: 1 },
        updated_at: new Date(),
      },
    })
    if (updated.count === 0) throw stale()
    const row = await db.announcement.findFirst({
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
  churchIds,
  announcementId,
  expectedVersion,
  actorId,
  requestId,
}: {
  churchIds: Set<string>
  announcementId: string
  expectedVersion: number
  actorId: string
  requestId: string
}): Promise<AnnouncementOutput> => {
  const churchId = toIds(churchIds)[0]
  if (!churchId) throw notFound()
  return db.$transaction(async (tx) => {
    const now = new Date()
    const updated = await tx.announcement.updateMany({
      where: { id: announcementId, church_id: churchId, version: expectedVersion },
      data: { published_at: now, version: { increment: 1 }, updated_at: now },
    })
    if (updated.count === 0) throw stale()
    const row = await db.announcement.findFirst({
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
    return mapAnnouncement(row)
  })
}
