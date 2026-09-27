import { GeneralError } from '@/utils/general-error'
import { withIdempotency } from '@/utils/idempotency'
import {
  MobileAnalyticsAck,
  MobileAnalyticsInput,
  MobileCheckInAck,
  MobileChurchListQuery,
  MobileChurchSummary,
  MobileMe,
  MobileMePatch,
  MobileMyChurch,
  MobilePublicAnnouncement,
  MobilePublicChurch,
  MobilePublicEvent,
  MobilePublishedPrayer,
  MobileRequestAck,
  MobileRequestInput,
} from '@/models/mobile'
import {
  CREATE_ANALYTICS_EVENTS,
  CREATE_CHECKIN,
  CREATE_USER_REQUEST,
  GET_HOME,
  GET_ME_PROFILE,
  GET_PUBLIC_CHURCH,
  GET_PUBLISHED_PRAYER,
  LIST_MY_CHURCHES,
  LIST_PUBLIC_ANNOUNCEMENTS,
  LIST_PUBLIC_CHURCHES,
  LIST_PUBLIC_EVENTS,
  LIST_PUBLISHED_PRAYERS,
  SET_FOLLOW,
  UPDATE_ME_PROFILE,
} from '@/providers/mobile'

/*
 * Mobile shared backend controllers (SPEC §8.4 / Tasks 39-43).
 *
 * Authorization model: every subject-scoped operation derives the user from
 * the session (Bearer token). There is NO user-id path/query param, so a
 * caller can never act on another user's data — mobile is subject-only.
 * Church-scoped reads/writes first require the church to be APPROVED:
 * unapproved/suspended/archived churches resolve to 404 (existence hidden).
 */

const notFound = (details = 'Resource not found.') =>
  new GeneralError({
    code: 404,
    error: 'NOT_FOUND',
    error_code: 'RESOURCE_NOT_FOUND',
    details,
  })

const notFoundChurch = () => notFound('Church not found or not available.')

const invalidSubject = () =>
  new GeneralError({
    code: 422,
    error: 'VALIDATION_ERROR',
    error_code: 'SUBJECT_REQUIRED',
    details: "subject is required for 'prayer' requests.",
    fields: { subject: 'Required for prayer requests.' },
  })

// ---------------------------------------------------------------------------
// Task 39 — discovery / public profile
// ---------------------------------------------------------------------------

export const listPublicChurches = async ({
  query,
}: {
  query: MobileChurchListQuery
}): Promise<{ result: MobileChurchSummary[]; total: number }> => LIST_PUBLIC_CHURCHES({ query })

export const getPublicChurch = async ({
  churchId,
  query,
}: {
  churchId: string
  query: MobileChurchListQuery
}): Promise<MobilePublicChurch> => {
  const row = await GET_PUBLIC_CHURCH({
    churchId,
    lat: query.latitude,
    lng: query.longitude,
  })
  if (!row) throw notFoundChurch()
  return row
}

// ---------------------------------------------------------------------------
// Task 40 — home / me / my churches / follows (subject-only)
// ---------------------------------------------------------------------------

export const getHome = async ({ userId }: { userId: string }) => GET_HOME({ userId })

export const getMe = async ({ userId }: { userId: string }): Promise<MobileMe> => {
  const me = await GET_ME_PROFILE({ userId })
  if (!me) throw notFound('User not found.')
  return {
    id: me.id,
    email: me.email,
    name: me.name,
    locale: me.locale,
    profilePicture: me.profilePicture,
    mainChurchId: me.mainChurchId,
  }
}

export const patchMe = async ({
  userId,
  data,
}: {
  userId: string
  data: MobileMePatch
}): Promise<MobileMe> => {
  const existing = await GET_ME_PROFILE({ userId })
  if (!existing) throw notFound('User not found.')
  const mainChurchId = data.mainChurchId === undefined ? existing.mainChurchId : data.mainChurchId
  await UPDATE_ME_PROFILE({
    userId,
    name: data.name,
    locale: data.locale,
    mainChurchId,
  })
  return {
    id: existing.id,
    email: existing.email,
    name: data.name ?? existing.name,
    locale: data.locale === undefined ? existing.locale : data.locale,
    profilePicture: existing.profilePicture,
    mainChurchId: mainChurchId ?? null,
  }
}

export const listMyChurches = async ({ userId }: { userId: string }): Promise<MobileMyChurch[]> =>
  LIST_MY_CHURCHES({ userId })

export const setFollow = async ({
  userId,
  churchId,
  isFollowed,
}: {
  userId: string
  churchId: string
  isFollowed: boolean
}): Promise<{ churchId: string; isFollowed: boolean }> => {
  const result = await SET_FOLLOW({ userId, churchId, isFollowed })
  if (!result) throw notFoundChurch()
  return result
}

// ---------------------------------------------------------------------------
// Task 41 — published prayers + approved audio
// ---------------------------------------------------------------------------

export const listPublishedPrayers = async ({
  churchId,
  query,
}: {
  churchId: string
  query: MobileChurchListQuery
}): Promise<{ result: MobilePublishedPrayer[]; total: number }> => {
  const church = await GET_PUBLIC_CHURCH({ churchId })
  if (!church) throw notFoundChurch()
  return LIST_PUBLISHED_PRAYERS({
    churchId,
    query: { page: query.page, limit: query.limit },
  })
}

export const getPublishedPrayer = async ({
  prayerId,
}: {
  prayerId: string
}): Promise<MobilePublishedPrayer> => {
  const prayer = await GET_PUBLISHED_PRAYER({ prayerId })
  if (!prayer) throw notFound('Prayer not found or not published.')
  return prayer
}

// ---------------------------------------------------------------------------
// Task 42 — published events + announcements
// ---------------------------------------------------------------------------

export const listPublicEvents = async ({
  churchId,
  query,
}: {
  churchId: string
  query: MobileChurchListQuery
}): Promise<{ result: MobilePublicEvent[]; total: number }> => {
  const church = await GET_PUBLIC_CHURCH({ churchId })
  if (!church) throw notFoundChurch()
  return LIST_PUBLIC_EVENTS({
    churchId,
    query: { page: query.page, limit: query.limit, category: query.search },
  })
}

export const listPublicAnnouncements = async ({
  churchId,
  query,
}: {
  churchId: string
  query: MobileChurchListQuery
}): Promise<{ result: MobilePublicAnnouncement[]; total: number }> => {
  const church = await GET_PUBLIC_CHURCH({ churchId })
  if (!church) throw notFoundChurch()
  return LIST_PUBLIC_ANNOUNCEMENTS({
    churchId,
    query: { page: query.page, limit: query.limit },
  })
}

// ---------------------------------------------------------------------------
// Task 43 — requests / check-ins / analytics intake
// ---------------------------------------------------------------------------

export const submitRequest = async ({
  userId,
  churchId,
  input,
  idempotencyKey,
  requestId,
}: {
  userId: string
  churchId: string
  input: MobileRequestInput
  idempotencyKey?: string
  requestId: string
}): Promise<MobileRequestAck> => {
  const church = await GET_PUBLIC_CHURCH({ churchId })
  if (!church) throw notFoundChurch()
  if (input.kind === 'prayer' && !input.subject?.trim()) throw invalidSubject()

  let ack: MobileRequestAck | null = null
  // Idempotent submission: same key + same payload replays the same resource.
  await withIdempotency({
    actorKey: `user:${userId}`,
    operation: 'request.submit',
    key: idempotencyKey ?? '',
    requestBody: input,
    run: async (tx) => {
      const created = await CREATE_USER_REQUEST({
        churchId,
        userId,
        data: input,
        requestId,
        tx,
      })
      ack = created
      return created.id
    },
  })
  return ack ?? { id: '', kind: input.kind, createdAt: new Date().toISOString() }
}

export const checkIn = async ({
  userId,
  churchId,
  idempotencyKey,
  requestId,
}: {
  userId: string
  churchId: string
  idempotencyKey?: string
  requestId: string
}): Promise<MobileCheckInAck> => {
  let ack: MobileCheckInAck | null = null
  await withIdempotency({
    actorKey: `user:${userId}`,
    operation: 'checkin.create',
    key: idempotencyKey ?? '',
    requestBody: { churchId },
    run: async () => {
      const created = await CREATE_CHECKIN({ churchId, userId, requestId })
      ack = created
      return created.id
    },
  })
  return ack ?? { id: '', churchId, occurredAt: new Date().toISOString(), localDate: '' }
}

export const recordAnalyticsEvents = async ({
  userId,
  input,
  requestId,
}: {
  userId: string
  input: MobileAnalyticsInput
  requestId: string
}): Promise<MobileAnalyticsAck> => {
  const allowed = new Set<string>(input.events.map((e) => e.eventType))
  if (allowed.size === 0) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'EVENTS_REQUIRED',
      details: 'At least one analytics event is required.',
    })
  }
  const { accepted } = await CREATE_ANALYTICS_EVENTS({
    userId,
    events: input.events.map((e) => ({
      eventKey: e.eventKey,
      eventType: e.eventType,
      occurredAt: e.occurredAt,
      churchId: e.churchId,
      resourceId: e.resourceId,
    })),
    requestId,
  })
  return { accepted }
}
