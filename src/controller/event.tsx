import { GeneralError } from '@/utils/general-error'
import { GET_AVAILABLE_LANGUAGE_CODES } from '@/providers/church'
import { CREATE_EVENT, GET_EVENT, LIST_EVENTS, UPDATE_EVENT } from '@/providers/event'
import { EventInput, EventListQuery, EventOutput } from '@/models/event'

/*
 * Event business logic (Task 26). category/date/url validated by zod at the
 * route; here we enforce church ownership (403/404) and language existence,
 * and delegate stale-version checks (409) to the provider's transactional
 * update.
 */

const scopeError = () =>
  new GeneralError({
    code: 403,
    error: 'UNAUTHORIZED',
    error_code: 'NOT_ALLOWED',
    details: 'This account is not allowed for this church.',
  })
const notFound = () =>
  new GeneralError({
    code: 404,
    error: 'NOT_FOUND',
    error_code: 'RESOURCE_NOT_FOUND',
    details: 'Event not found.',
  })
const stale = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'STALE_VERSION',
    details: 'This event has changed. Refresh and try again.',
  })

const validateLanguage = async (languageCode?: string | null) => {
  if (!languageCode) return
  const langs = await GET_AVAILABLE_LANGUAGE_CODES({ codes: [languageCode] })
  if (!langs.has(languageCode)) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'UNKNOWN_LANGUAGE',
      details: 'Unknown or disabled language.',
      fields: { languageCode: 'Unknown or disabled.' },
    })
  }
}

export const listEvents = async ({
  churchIds,
  query,
}: {
  churchIds: Set<string>
  query: EventListQuery
}): Promise<{ result: EventOutput[]; total: number }> => LIST_EVENTS({ churchIds, query })

export const createEvent = async ({
  userId,
  churchId,
  churchIds,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  input: EventInput
  requestId: string
}): Promise<EventOutput> => {
  if (!churchIds.has(churchId)) throw scopeError()
  await validateLanguage(input.languageCode)
  return CREATE_EVENT({ churchId, data: input, actorId: userId, requestId })
}

export const patchEvent = async ({
  userId,
  churchId,
  churchIds,
  eventId,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  eventId: string
  input: EventInput
  requestId: string
}): Promise<EventOutput> => {
  if (!churchIds.has(churchId)) throw scopeError()
  if (!input.version)
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'VERSION_REQUIRED',
      details: 'version is required to edit an event.',
    })
  const current = await GET_EVENT({ churchId, churchIds, eventId })
  if (!current) throw notFound()
  if (input.version !== current.version) throw stale()
  await validateLanguage(input.languageCode)
  return UPDATE_EVENT({
    churchId,
    churchIds,
    eventId,
    expectedVersion: input.version,
    data: input,
    actorId: userId,
    requestId,
  })
}
