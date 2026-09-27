import { GeneralError } from '@/utils/general-error'
import { GET_CHURCH_VERSION } from '@/providers/church'
import { GET_SERVICE_TIMES, REPLACE_SERVICE_TIMES } from '@/providers/service-time'
import { ServiceTimeEntry, ServiceTimeScheduleInput } from '@/models/service-time'

/*
 * Service time controller (Task 14). Church scoping is enforced by the caller's
 * `churchIds`; the schedule is replaced transactionally against the church
 * concurrency `version` (409 when stale).
 */

export const getServiceTimes = async ({
  churchIds,
}: {
  churchIds: Set<string>
}): Promise<ServiceTimeEntry[]> => {
  if (churchIds.size === 0) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'RESOURCE_NOT_FOUND',
      details: 'Church not found.',
    })
  }
  return GET_SERVICE_TIMES({ churchIds })
}

export const replaceServiceTimes = async ({
  userId,
  churchId,
  churchIds,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  input: ServiceTimeScheduleInput
  requestId: string
}): Promise<{ count: number }> => {
  if (!churchIds.has(churchId)) {
    throw new GeneralError({
      code: 403,
      error: 'UNAUTHORIZED',
      error_code: 'NOT_ALLOWED',
      details: 'This account is not allowed for this church.',
    })
  }
  const currentVersion = await GET_CHURCH_VERSION({ churchIds })
  if (currentVersion === null) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'RESOURCE_NOT_FOUND',
      details: 'Church not found.',
    })
  }
  if (input.version !== currentVersion) {
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'STALE_VERSION',
      details: 'This church has changed. Refresh and try again.',
    })
  }
  return REPLACE_SERVICE_TIMES({
    churchIds,
    expectedVersion: input.version,
    schedule: input.schedule,
    requestId,
    actorId: userId,
  })
}
