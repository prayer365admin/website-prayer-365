import { GeneralError } from '@/utils/general-error'
import { sanitizePrayerRichText } from '@/utils/sanitize-prayer-rich-text'
import { richTextToPlainText } from '@/utils/rich-text-plain'
import { withIdempotency } from '@/utils/idempotency'
import { auditPayload } from '@/utils/audit'
import {
  GET_AVAILABLE_LANGUAGE_CODES,
  GET_CHURCH_NAMES,
  GET_CHURCH_READY_IMAGE,
} from '@/providers/church'
import { GET_CHURCH_PASTOR } from '@/providers/pastor'
import {
  APPROVE_TEXT,
  CREATE_PRAYER_WITH_VERSION,
  CREATE_VERSION_SNAPSHOT,
  GET_PRAYER,
  GET_VERSION,
  LIST_PRAYERS,
  SCHEDULE_PRAYER,
} from '@/providers/prayer'
import {
  CentralPrayerListQuery,
  CentralPrayerOutput,
  PrayerActionInput,
  PrayerInput,
  PrayerListQuery,
  PrayerOutput,
  PrayerVersionOutput,
  PublishInput,
  ScheduleInput,
} from '@/models/prayer'

const sanitizePrayerCopy = (input: PrayerInput) => {
  const introduction = input.introduction
    ? sanitizePrayerRichText(input.introduction) || null
    : null
  const body = sanitizePrayerRichText(input.body)
  if (!richTextToPlainText(body)) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'BODY_REQUIRED',
      details: 'Full prayer text is required.',
    })
  }
  return { introduction, body }
}

/*
 * Prayer business logic (Tasks 21/22/25).
 *
 * - create: Prayer + initial immutable version + current_version_id in one tx.
 * - patch: NEW immutable snapshot (bump), never mutates an approved one.
 * - approve-text: reviewer marks the current snapshot approved.
 * - schedule: sets scheduled_version_id + scheduled_at (both-or-null).
 * - publish: sets published pointers, clears schedule, enqueues prayer.publish.
 *   D4 resolved: audio is optional — only current text must be approved.
 *
 * Every transition is gated on Prayer.version (stale → 409) and the exact
 * current text snapshot (prayerVersionId must equal current_version_id).
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
    details: 'Prayer not found.',
  })
const stale = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'STALE_VERSION',
    details: 'This prayer has changed. Refresh and try again.',
  })
const notCurrent = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'WRONG_SNAPSHOT',
    details: 'That version is not the current snapshot.',
  })
const unapproved = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'PRAYER_NOT_APPROVED',
    details: 'The current text must be approved first.',
  })
const alreadyPublished = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'VERSION_ALREADY_PUBLISHED',
    details: 'This version is already published. Edit the text to publish a new version.',
  })

const validatePastorAndLanguage = async ({
  churchIds,
  pastorId,
  languageCode,
}: {
  churchIds: Set<string>
  pastorId: string
  languageCode: string
}) => {
  const pastor = await GET_CHURCH_PASTOR({ churchIds, pastorId })
  if (!pastor) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'UNKNOWN_PASTOR',
      details: 'This pastor is not assigned to the church.',
      fields: { pastorId: 'Not assigned to this church.' },
    })
  }
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

const validateFeaturedAsset = async (churchId: string, assetId: string | null | undefined) => {
  if (!assetId) return null
  const asset = await GET_CHURCH_READY_IMAGE({ churchIds: new Set([churchId]), assetId })
  if (!asset) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'INVALID_FEATURED_ASSET',
      details: 'featuredAssetId must be a ready image owned by this church.',
      fields: { featuredAssetId: 'Not a ready image of this church.' },
    })
  }
  return assetId
}

export const listPrayers = async ({
  churchIds,
  query,
}: {
  churchIds: Set<string>
  query: PrayerListQuery
}): Promise<{ result: PrayerOutput[]; total: number }> => LIST_PRAYERS({ churchIds, query })

/**
 * Central (cross-church) prayer list (plan 023). Reuses the church list query with
 * the caller's whole central subtree; a `churchId` filter only NARROWS inside that
 * scope, so it can never reach a church outside the caller's coverage.
 */
export const listCentralPrayers = async ({
  churchIds,
  query,
}: {
  churchIds: Set<string>
  query: CentralPrayerListQuery
}): Promise<{ result: CentralPrayerOutput[]; total: number }> => {
  const scope = query.churchId
    ? churchIds.has(query.churchId)
      ? new Set([query.churchId])
      : new Set<string>()
    : churchIds
  const { result, total } = await LIST_PRAYERS({ churchIds: scope, query })
  if (result.length === 0) return { result: [], total }

  const names = await GET_CHURCH_NAMES({ ids: Array.from(new Set(result.map((p) => p.churchId))) })
  const nameById = new Map(names.map((c) => [c.id, c.name]))
  return {
    result: result.map((prayer) => ({
      ...prayer,
      churchName: nameById.get(prayer.churchId) ?? '-',
    })),
    total,
  }
}

export const getPrayer = async ({
  churchIds,
  prayerId,
}: {
  churchIds: Set<string>
  prayerId: string
}): Promise<PrayerOutput> => {
  const row = await GET_PRAYER({ churchIds, prayerId })
  if (!row) throw notFound()
  return row
}

export const getCentralPrayer = async ({
  churchIds,
  prayerId,
}: {
  churchIds: Set<string>
  prayerId: string
}): Promise<CentralPrayerOutput> => {
  const prayer = await getPrayer({ churchIds, prayerId })
  const [church] = await GET_CHURCH_NAMES({ ids: [prayer.churchId] })
  return { ...prayer, churchName: church?.name ?? '-' }
}

/** POST: prayer + initial version + pointer in ONE transaction. */
export const createPrayer = async ({
  userId,
  churchId,
  churchIds,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  input: PrayerInput
  requestId: string
}): Promise<PrayerOutput> => {
  if (!churchIds.has(churchId)) throw scopeError()
  await validatePastorAndLanguage({
    churchIds,
    pastorId: input.pastorId,
    languageCode: input.languageCode,
  })
  const copy = sanitizePrayerCopy(input)
  const featuredAssetId = await validateFeaturedAsset(churchId, input.featuredAssetId)
  return CREATE_PRAYER_WITH_VERSION({
    churchId,
    data: {
      pastorId: input.pastorId,
      title: input.title,
      introduction: copy.introduction,
      body: copy.body,
      languageCode: input.languageCode,
      featuredAssetId,
    },
    actorId: userId,
    requestId,
  })
}

/** PATCH: new immutable snapshot (bump version_number), never edits an approved one. */
export const patchPrayer = async ({
  userId,
  churchId,
  churchIds,
  prayerId,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  prayerId: string
  input: PrayerInput
  requestId: string
}): Promise<PrayerOutput> => {
  if (!churchIds.has(churchId)) throw scopeError()
  if (!input.version)
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'VERSION_REQUIRED',
      details: 'version is required to edit a prayer.',
    })
  const current = await GET_PRAYER({ churchIds, prayerId })
  if (!current) throw notFound()
  if (input.version !== current.version) throw stale()
  await validatePastorAndLanguage({
    churchIds,
    pastorId: input.pastorId,
    languageCode: input.languageCode,
  })
  const copy = sanitizePrayerCopy(input)
  const featuredAssetId = await validateFeaturedAsset(churchId, input.featuredAssetId)
  return CREATE_VERSION_SNAPSHOT({
    churchIds,
    prayerId,
    expectedVersion: input.version,
    data: {
      pastorId: input.pastorId,
      title: input.title,
      introduction: copy.introduction,
      body: copy.body,
      languageCode: input.languageCode,
      featuredAssetId,
    },
    actorId: userId,
    requestId,
  })
}

/** approve-text: reviewer approves the current snapshot. */
export const approveText = async ({
  userId,
  churchId,
  churchIds,
  prayerId,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  prayerId: string
  input: PrayerActionInput
  requestId: string
}): Promise<PrayerVersionOutput> => {
  if (!churchIds.has(churchId)) throw scopeError()
  const ctx = await GET_VERSION({ churchIds, prayerId, versionId: input.prayerVersionId })
  if (!ctx) throw notFound()
  if (ctx.prayer.version !== input.version) throw stale()
  if (ctx.prayer.current_version_id !== input.prayerVersionId) throw notCurrent()
  return APPROVE_TEXT({
    churchIds,
    prayerId,
    expectedVersion: input.version,
    prayerVersionId: input.prayerVersionId,
    actorId: userId,
    requestId,
  })
}

/** schedule: preconditions current version approved; sets both-or-null pointers. */
export const schedulePrayer = async ({
  userId,
  churchId,
  churchIds,
  prayerId,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  prayerId: string
  input: ScheduleInput
  requestId: string
}): Promise<PrayerOutput> => {
  if (!churchIds.has(churchId)) throw scopeError()
  const ctx = await GET_VERSION({ churchIds, prayerId, versionId: input.prayerVersionId })
  if (!ctx) throw notFound()
  if (ctx.prayer.version !== input.version) throw stale()
  if (ctx.prayer.current_version_id !== input.prayerVersionId) throw notCurrent()
  if (!ctx.version.approved_at) throw unapproved()
  // An already-published version can never fire: the due-scan skips rows whose
  // published pointer still equals the scheduled one, so accepting this would leave
  // the prayer stuck in "scheduled". Clearing a schedule (scheduledAt null) stays allowed.
  if (input.scheduledAt && ctx.prayer.published_version_id === input.prayerVersionId)
    throw alreadyPublished()
  return SCHEDULE_PRAYER({
    churchIds,
    prayerId,
    expectedVersion: input.version,
    prayerVersionId: input.prayerVersionId,
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    actorId: userId,
    requestId,
  })
}

/** publish: D4 resolved — text-only allowed (audio optional). Idempotent. */
export const publishPrayer = async ({
  userId,
  churchId,
  churchIds,
  prayerId,
  input,
  idempotencyKey,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  prayerId: string
  input: PublishInput
  idempotencyKey?: string
  requestId: string
}): Promise<PrayerOutput> => {
  if (!churchIds.has(churchId)) throw scopeError()
  const ctx = await GET_VERSION({ churchIds, prayerId, versionId: input.prayerVersionId })
  if (!ctx) throw notFound()
  if (ctx.prayer.version !== input.version) throw stale()
  if (ctx.prayer.current_version_id !== input.prayerVersionId) throw notCurrent()
  if (!ctx.version.approved_at) throw unapproved()

  // Publish + schedule-clear + outbox + audit atomically inside the idempotency
  // transaction so re-publish with the same key is safe (no duplicate effects).
  await withIdempotency({
    actorKey: `user:${userId}`,
    operation: 'prayer.publish',
    key: idempotencyKey ?? '',
    requestBody: input,
    run: async (tx) => {
      const verse = await tx.prayerVersion.findFirst({
        where: { id: input.prayerVersionId, prayer_id: prayerId },
        select: { approved_at: true },
      })
      if (!verse || !verse.approved_at) throw unapproved()
      const upd = await tx.prayer.updateMany({
        where: { id: prayerId, church_id: churchId, version: input.version },
        data: { version: { increment: 1 }, updated_at: new Date() },
      })
      if (upd.count === 0) throw stale()
      const now = new Date()
      await tx.prayer.update({
        where: { id: prayerId },
        data: {
          published_version_id: input.prayerVersionId,
          published_at: now,
          scheduled_version_id: null,
          scheduled_at: null,
        },
      })
      await tx.outboxJob.create({
        data: {
          kind: 'prayer.publish',
          dedupe_key: `prayer.publish:${prayerId}:${input.prayerVersionId}`,
          resource_id: prayerId,
          payload: { prayerVersionId: input.prayerVersionId, churchId },
          available_at: now,
        },
      })
      await tx.auditLog.create({
        data: auditPayload({
          actorId: userId,
          churchId,
          action: 'prayer.publish',
          resourceType: 'prayer',
          resourceId: prayerId,
          outcome: 'success',
          requestId,
        }),
      })
      return prayerId
    },
  })
  const out = await GET_PRAYER({ churchIds, prayerId })
  if (!out) throw notFound()
  return out
}
