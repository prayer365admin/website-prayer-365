import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import { auditPayload } from '@/utils/audit'
import { ServiceTimeEntry } from '@/models/service-time'

/*
 * Service time adapter (Task 14). The week schedule is read scoped by
 * `churchIds` and replaced wholesale in a transaction gated by the church
 * `version`. `local_time` is a PostgreSQL `time` column; we store the parsed
 * wall-clock on a fixed reference date.
 */

const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

const parseLocalTime = (value: string, field: string): Date => {
  if (!LOCAL_TIME_PATTERN.test(value)) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'INVALID_LOCAL_TIME',
      details: `${field} must be HH:MM or HH:MM:SS.`,
      fields: { [field]: 'Invalid time.' },
    })
  }
  const [h, m, s = '00'] = value.split(':')
  return new Date(Date.UTC(1970, 0, 1, Number(h), Number(m), Number(s)))
}

export const GET_SERVICE_TIMES = async ({
  churchId,
  churchIds,
}: {
  churchId: string
  churchIds: Set<string>
}): Promise<ServiceTimeEntry[]> => {
  if (!churchIds.has(churchId)) return []
  const rows = await db.serviceTime.findMany({
    where: { church_id: churchId },
    orderBy: [{ weekday: 'asc' }, { local_time: 'asc' }],
  })
  return rows.map((r) => ({
    id: r.id,
    weekday: r.weekday,
    localTime: r.local_time.toISOString().slice(11, 19),
    label: r.label,
    languageCode: r.language_code,
  }))
}

/** Transactionally replace the weekly schedule, gated on church version. */
export const REPLACE_SERVICE_TIMES = async ({
  churchId,
  churchIds,
  expectedVersion,
  schedule,
  requestId,
  actorId,
}: {
  churchId: string
  churchIds: Set<string>
  expectedVersion: number
  schedule: Array<{
    weekday: number
    localTime: string
    label?: string | null
    languageCode?: string | null
  }>
  requestId: string
  actorId?: string | null
}): Promise<{ count: number }> => {
  const ids = Array.from(churchIds)
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
      data: { version: { increment: 1 }, updated_at: new Date() },
    })
    if (updated.count === 0) {
      throw new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'STALE_VERSION',
        details: 'This church has changed. Refresh and try again.',
      })
    }
    await tx.serviceTime.deleteMany({ where: { church_id: churchId } })
    if (schedule.length > 0) {
      await tx.serviceTime.createMany({
        data: schedule.map((s) => {
          const local = parseLocalTime(s.localTime, 'schedule.localTime')
          return {
            church_id: churchId,
            weekday: s.weekday,
            local_time: local,
            label: s.label ?? null,
            language_code: s.languageCode ?? null,
          }
        }),
      })
    }
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        churchId,
        action: 'church.service-times.update',
        resourceType: 'church',
        resourceId: churchId,
        outcome: 'success',
        requestId,
      }),
    })
    return { count: schedule.length }
  })
}
