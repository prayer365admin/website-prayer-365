import { cache } from 'react'
import { GeneralError } from '@/utils/general-error'
import { withIdempotency } from '@/utils/idempotency'
import { auditPayload } from '@/utils/audit'
import { dbTransaction } from '@/utils/db-transaction'
import {
  MobileAnalyticsAck,
  MobileAnalyticsInput,
  MobileCheckInAck,
  MobileChurchListQuery,
  MobileChurchSummary,
  MobileDeviceRegistration,
  MobileMe,
  MobileMePatch,
  MobileMyChurch,
  MobileNotificationPreferences,
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
  COUNT_RECENT_USER_REQUESTS,
  CREATE_USER_REQUEST,
  DISABLE_DEVICE_TOKEN,
  GET_CHECK_IN_ACK,
  GET_HOME,
  GET_ME_PROFILE,
  GET_NOTIFICATION_PREFERENCES,
  GET_PUBLIC_CHURCH,
  GET_PUBLISHED_PRAYER,
  GET_USER_REQUEST_ACK,
  LIST_MY_CHURCHES,
  LIST_PUBLIC_ANNOUNCEMENTS,
  LIST_PUBLIC_CHURCHES,
  LIST_PUBLIC_EVENTS,
  LIST_PUBLISHED_PRAYERS,
  SET_FOLLOW,
  UPDATE_ME_PROFILE,
  UPSERT_DEVICE_TOKEN,
  UPSERT_NOTIFICATION_PREFERENCES,
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
  slug,
  churchId,
  query,
}: {
  slug?: string
  churchId?: string
  /** Directory filters are optional: a single-church read needs no page/search query. */
  query?: MobileChurchListQuery
}): Promise<MobilePublicChurch> => {
  const target = slug ?? churchId ?? ''
  const row = await GET_PUBLIC_CHURCH({
    slug: target,
    lat: query?.latitude,
    lng: query?.longitude,
  })
  if (!row) throw notFoundChurch()
  return row
}

// ---------------------------------------------------------------------------
// Task 40 — home / me / my churches / follows (subject-only)
// ---------------------------------------------------------------------------

export const getHome = async ({ userId }: { userId: string }) => GET_HOME({ userId })

/*
 * Request-scoped reads. The `(site)` layout and the page inside it both need the
 * same user record and church list, and React's cache() collapses the pair into
 * one query (same pattern as utils/required-webauth.ts). Keyed on the primitive
 * user id on purpose — an object argument is a new identity on every call, so it
 * would always miss. Outside a React render (API routes) this simply calls through.
 */
const getMeProfileOnce = cache((userId: string) => GET_ME_PROFILE({ userId }))
const listMyChurchesOnce = cache((userId: string) => LIST_MY_CHURCHES({ userId }))

export const getMe = async ({ userId }: { userId: string }): Promise<MobileMe> => {
  const me = await getMeProfileOnce(userId)
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
  data: MobileMePatch & { localeSkipped?: boolean }
}): Promise<MobileMe> => {
  const existing = await GET_ME_PROFILE({ userId })
  if (!existing) throw notFound('User not found.')
  const mainChurchId = data.mainChurchId === undefined ? existing.mainChurchId : data.mainChurchId
  const profilePicture =
    data.profilePicture === undefined ? existing.profilePicture : data.profilePicture
  await UPDATE_ME_PROFILE({
    userId,
    name: data.name,
    locale: data.locale,
    localeChosen: !data.localeSkipped,
    mainChurchId,
    profilePicture,
  })
  return {
    id: existing.id,
    email: existing.email,
    name: data.name ?? existing.name,
    locale: data.locale === undefined ? existing.locale : data.locale,
    profilePicture,
    mainChurchId: mainChurchId ?? null,
  }
}

export const listMyChurches = async ({ userId }: { userId: string }): Promise<MobileMyChurch[]> =>
  listMyChurchesOnce(userId)

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
  slug,
  churchId,
  query,
}: {
  slug?: string
  churchId?: string
  query: MobileChurchListQuery
}): Promise<{ result: MobilePublishedPrayer[]; total: number }> => {
  const target = slug ?? churchId ?? ''
  const church = await GET_PUBLIC_CHURCH({ slug: target })
  if (!church) throw notFoundChurch()
  return LIST_PUBLISHED_PRAYERS({
    churchId: church.id,
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
  slug,
  churchId,
  query,
}: {
  slug?: string
  churchId?: string
  query: MobileChurchListQuery
}): Promise<{ result: MobilePublicEvent[]; total: number }> => {
  const target = slug ?? churchId ?? ''
  const church = await GET_PUBLIC_CHURCH({ slug: target })
  if (!church) throw notFoundChurch()
  return LIST_PUBLIC_EVENTS({
    churchId: church.id,
    query: { page: query.page, limit: query.limit, category: query.search },
  })
}

export const listPublicAnnouncements = async ({
  slug,
  churchId,
  query,
}: {
  slug?: string
  churchId?: string
  query: MobileChurchListQuery
}): Promise<{ result: MobilePublicAnnouncement[]; total: number }> => {
  const target = slug ?? churchId ?? ''
  const church = await GET_PUBLIC_CHURCH({ slug: target })
  if (!church) throw notFoundChurch()
  return LIST_PUBLIC_ANNOUNCEMENTS({
    churchId: church.id,
    query: { page: query.page, limit: query.limit },
  })
}

// ---------------------------------------------------------------------------
// Task 43 — requests / check-ins / analytics intake
// ---------------------------------------------------------------------------

// Submission rate limit (F7RQ R6): per user across all churches in a rolling window.
const getRequestLimit = () => Number(process.env.REQUEST_SUBMIT_LIMIT) || 5
const getRequestWindowMinutes = () => Number(process.env.REQUEST_SUBMIT_WINDOW_MINUTES) || 10

const rateLimited = () =>
  new GeneralError({
    code: 429,
    error: 'TOO_MANY_REQUESTS',
    error_code: 'RATE_LIMITED',
    details: 'Too many requests sent. Please try again later.',
  })

export const submitRequest = async ({
  userId,
  slug,
  churchId,
  input,
  idempotencyKey,
  requestId,
}: {
  userId: string
  slug?: string
  churchId?: string
  input: MobileRequestInput
  idempotencyKey?: string
  requestId: string
}): Promise<MobileRequestAck> => {
  const target = slug ?? churchId ?? ''
  const church = await GET_PUBLIC_CHURCH({ slug: target })
  if (!church) throw notFoundChurch()
  if (input.kind === 'prayer' && !input.subject?.trim()) throw invalidSubject()

  let ack: MobileRequestAck | null = null
  // Idempotent submission: same key + same payload replays the same resource.
  // churchId is part of the hashed body so a key reused at another church is a
  // conflict, never a replay of the first church's request.
  const { resource_id } = await withIdempotency({
    actorKey: `user:${userId}`,
    operation: 'request.submit',
    key: idempotencyKey ?? '',
    requestBody: { churchId: church.id, ...input },
    run: async (tx) => {
      // Only fresh submissions reach here, so replays never count against the
      // limit. Throwing rolls back the transaction: no row, no idempotency record.
      // ponytail: count-then-insert can let a parallel burst slip one past the
      // limit; move to a shared limiter if that ever matters.
      const since = new Date(Date.now() - getRequestWindowMinutes() * 60 * 1000)
      const recent = await COUNT_RECENT_USER_REQUESTS({ userId, since, tx })
      if (recent >= getRequestLimit()) throw rateLimited()
      const created = await CREATE_USER_REQUEST({
        churchId: church.id,
        userId,
        data: input,
        requestId,
        tx,
      })
      ack = created
      return created.id
    },
  })
  if (ack) return ack
  // Replay (e.g. the client lost the first response): return the original ack.
  const replay = resource_id ? await GET_USER_REQUEST_ACK({ id: resource_id, userId }) : null
  if (!replay) throw notFound('Request not found.')
  return replay
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
  const outcome = await withIdempotency({
    actorKey: `user:${userId}`,
    operation: 'checkin.create',
    key: idempotencyKey ?? '',
    requestBody: { churchId },
    run: async () => {
      const created = await CREATE_CHECKIN({ churchId, userId, requestId })
      return created.id
    },
  })
  // AA-1 — a replay must return the stored row, never a synthetic empty ack.
  const ack = outcome.resource_id
    ? await GET_CHECK_IN_ACK({ id: outcome.resource_id, userId })
    : null
  if (!ack) throw notFound('Check-in not found.')
  return ack
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

// ---------------------------------------------------------------------------
// F12 — notification preferences + device registration (MB-04 / MB-05)
// ---------------------------------------------------------------------------

export const getNotificationPreferences = async ({ userId }: { userId: string }) =>
  GET_NOTIFICATION_PREFERENCES({ userId })

export const saveNotificationPreferences = async ({
  userId,
  input,
  requestId,
}: {
  userId: string
  input: MobileNotificationPreferences
  requestId: string
}) =>
  dbTransaction(async (tx) => {
    await UPSERT_NOTIFICATION_PREFERENCES({ userId, prefs: input }, tx)
    await tx.auditLog.create({
      data: auditPayload({
        actorId: userId,
        action: 'notification_preferences.update',
        resourceType: 'notification_preferences',
        resourceId: userId,
        outcome: 'success',
        requestId,
      }),
    })
    // The request carries all six keys, so it is the saved state — reading through
    // the global client here would run outside this transaction and could be stale.
    return input
  })

export const registerDevice = async ({
  userId,
  installationId,
  input,
  requestId,
}: {
  userId: string
  installationId: string
  input: MobileDeviceRegistration
  requestId: string
}) =>
  dbTransaction(async (tx) => {
    const row = await UPSERT_DEVICE_TOKEN(
      { userId, installationId, platform: input.platform, token: input.token },
      tx,
    )
    await tx.auditLog.create({
      data: auditPayload({
        actorId: userId,
        action: 'device.register',
        resourceType: 'device_token',
        resourceId: row.id,
        outcome: 'success',
        requestId,
      }),
    })
    return {
      installationId: row.installation_id,
      platform: row.platform,
      provider: 'fcm',
      updatedAt: row.created_at.toISOString(),
    }
  })

export const revokeDevice = async ({
  userId,
  installationId,
  requestId,
}: {
  userId: string
  installationId: string
  requestId: string
}) =>
  dbTransaction(async (tx) => {
    const result = await DISABLE_DEVICE_TOKEN({ userId, installationId })
    await tx.auditLog.create({
      data: auditPayload({
        actorId: userId,
        action: 'device.revoke',
        resourceType: 'device_token',
        resourceId: installationId,
        outcome: result.count > 0 ? 'success' : 'no_change',
        requestId,
      }),
    })
    return { revoked: result.count }
  })
