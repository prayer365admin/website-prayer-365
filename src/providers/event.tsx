import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import { auditPayload } from '@/utils/audit'
import { EventInput, EventListQuery, EventOutput, mapEvent } from '@/models/event'

/*
 * Event adapter (Task 26). Reads are scoped by `churchIds` — a caller can
 * never observe or mutate an event outside their church set. Writes validate
 * category/date/url in the controller via zod; ownership + version are checked
 * here transactionally (stale → 409).
 */

const toIds = (churchIds: Set<string>) => Array.from(churchIds)
const stale = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'STALE_VERSION',
    details: 'This event has changed. Refresh and try again.',
  })

export const LIST_EVENTS = async ({
  churchIds,
  query,
}: {
  churchIds: Set<string>
  query: EventListQuery
}): Promise<{ result: EventOutput[]; total: number }> => {
  const ids = toIds(churchIds)
  const where: Prisma.EventWhereInput = {
    church_id: { in: ids },
    ...(query.category ? { category: query.category } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { location: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.has_link === 'yes' ? { registration_url: { not: null } } : {}),
    ...(query.has_link === 'no' ? { registration_url: null } : {}),
    ...(query.starts_from || query.starts_to
      ? {
          starts_at: {
            ...(query.starts_from ? { gte: new Date(query.starts_from) } : {}),
            ...(query.starts_to ? { lte: new Date(query.starts_to) } : {}),
          },
        }
      : {}),
  }
  const orderByMap: Record<string, Prisma.EventOrderByWithRelationInput[]> = {
    starts_at: [{ starts_at: query.order_direction }, { id: 'asc' }],
    created_at: [{ created_at: query.order_direction }, { id: 'asc' }],
    title: [{ title: query.order_direction }, { id: 'asc' }],
  }
  const [total, rows] = await db.$transaction([
    db.event.count({ where }),
    db.event.findMany({
      where,
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      orderBy: orderByMap[query.order_by],
    }),
  ])
  return { result: rows.map(mapEvent), total }
}

export const GET_EVENT = async ({
  churchId,
  churchIds,
  eventId,
}: {
  churchId: string
  churchIds: Set<string>
  eventId: string
}): Promise<EventOutput | null> => {
  if (!churchIds.has(churchId)) return null
  const row = await db.event.findFirst({ where: { id: eventId, church_id: churchId } })
  return row ? mapEvent(row) : null
}

export const CREATE_EVENT = async ({
  churchId,
  data,
  actorId,
  requestId,
}: {
  churchId: string
  data: EventInput
  actorId: string
  requestId: string
}): Promise<EventOutput> => {
  const row = await db.event.create({
    data: {
      church_id: churchId,
      category: data.category,
      title: data.title,
      description: data.description,
      starts_at: new Date(data.startsAt),
      location: data.location,
      registration_url: data.registrationUrl ?? null,
      language_code: data.languageCode ?? null,
    },
  })
  await db.auditLog.create({
    data: auditPayload({
      actorId,
      churchId,
      action: 'event.create',
      resourceType: 'event',
      resourceId: row.id,
      outcome: 'success',
      requestId,
    }),
  })
  return mapEvent(row)
}

export const UPDATE_EVENT = async ({
  churchId,
  churchIds,
  eventId,
  expectedVersion,
  data,
  actorId,
  requestId,
}: {
  churchId: string
  churchIds: Set<string>
  eventId: string
  expectedVersion: number
  data: EventInput
  actorId: string
  requestId: string
}): Promise<EventOutput> => {
  if (!churchIds.has(churchId)) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'RESOURCE_NOT_FOUND',
      details: 'Event not found.',
    })
  }
  return db.$transaction(async (tx) => {
    const updated = await tx.event.updateMany({
      where: { id: eventId, church_id: churchId, version: expectedVersion },
      data: {
        category: data.category,
        title: data.title,
        description: data.description,
        starts_at: new Date(data.startsAt),
        location: data.location,
        registration_url: data.registrationUrl ?? null,
        language_code: data.languageCode ?? null,
        version: { increment: 1 },
        updated_at: new Date(),
      },
    })
    if (updated.count === 0) throw stale()
    const row = await tx.event.findFirst({ where: { id: eventId, church_id: churchId } })
    if (!row) throw stale()
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        churchId,
        action: 'event.update',
        resourceType: 'event',
        resourceId: eventId,
        outcome: 'success',
        requestId,
      }),
    })
    return mapEvent(row)
  })
}
