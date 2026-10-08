import { GeneralError } from '@/utils/general-error'
import { requiredScope } from '@/utils/required-scope'
import { GET_REQUEST, GET_REQUESTS } from '@/providers/request'
import { RequestOutput, RequestListSummary } from '@/models/request'
import { ParsedListQuery } from '@/utils/pagination'

/*
 * Sensitive request controller (Task 28 / SPEC §8.2, §9.5). Read-only.
 *
 * Base access needs `prayer_request:read` at the church; a caller that does
 * NOT hold `prayer_private_request:read` scoped DIRECTLY to that church
 * (churchLocalGrant) sees only STANDARD rows. Private rows are filtered
 * before count/pagination, and any out-of-scope or private-to-caller row is
 * returned as 404 so existence is never revealed.
 */

type Scope = { churchIds: Set<string> }

const NOT_FOUND = () =>
  new GeneralError({
    code: 404,
    error: 'NOT_FOUND',
    error_code: 'RESOURCE_NOT_FOUND',
    details: 'Request not found.',
  })

/**
 * Resolve base request-read scope. Compared to the resource itself, a caller
 * without church request access is "out of scope" → 404 (hide existence)
 * rather than a blanket 403.
 */
export const resolveRequestReadScope = async ({
  userId,
  churchId,
}: {
  userId: string
  churchId: string
}): Promise<Scope> => {
  try {
    const scope = await requiredScope({
      userId,
      churchId,
      subject: 'prayer_request',
      action: 'read',
    })
    return { churchIds: scope.churchIds }
  } catch (e) {
    if (e instanceof GeneralError && e.code === 403) throw NOT_FOUND()
    throw e
  }
}

/** Caller also holds the church-local private-request grant. Shared with the overview. */
export const hasPrivateGrant = async ({
  userId,
  churchId,
}: {
  userId: string
  churchId: string
}): Promise<boolean> => {
  try {
    await requiredScope({
      userId,
      churchId,
      subject: 'prayer_private_request',
      action: 'read',
      churchLocalGrant: true,
    })
    return true
  } catch (e) {
    if (e instanceof GeneralError && e.code === 403) return false
    throw e
  }
}

const assertChurchInScope = (churchId: string, churchIds: Set<string>) => {
  if (!churchIds.has(churchId)) throw NOT_FOUND()
}

/** GET C/requests — authorized summaries, private filter applied before count. */
export const listRequests = async ({
  userId,
  churchId,
  churchIds,
  kinds,
  query,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  kinds?: string[]
  query: ParsedListQuery
}): Promise<{ result: RequestListSummary[]; total: number }> => {
  assertChurchInScope(churchId, churchIds)
  const canReadPrivate = await hasPrivateGrant({ userId, churchId })
  return GET_REQUESTS({ churchId, kinds, canReadPrivate, query })
}

/** GET C/requests/:requestId — authorized detail; 404 for out-of-scope/private. */
export const getRequestDetail = async ({
  userId,
  churchId,
  churchIds,
  requestId,
  traceId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  requestId: string
  traceId: string
}): Promise<RequestOutput> => {
  assertChurchInScope(churchId, churchIds)
  const canReadPrivate = await hasPrivateGrant({ userId, churchId })
  const row = await GET_REQUEST({ churchId, requestId, canReadPrivate, actorId: userId, traceId })
  if (!row) throw NOT_FOUND()
  return row
}
