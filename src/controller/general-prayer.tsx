import { Prisma } from '@prisma/client'
import { GeneralError } from '@/utils/general-error'
import { auditPayload } from '@/utils/audit'
import { db } from '@/utils/db-connection'
import { sanitizePrayerRichText } from '@/utils/sanitize-prayer-rich-text'
import { generatedAudioDurationSeconds } from '@/utils/prayer-duration'
import { nextSendAt, sequenceFor, todayInTallinn } from '@/utils/general-prayer-cycle'
import { S3_PUBLIC_URL } from '@/providers/s3'
import { GET_AVAILABLE_LANGUAGE_CODES } from '@/providers/church'
import {
  COUNT_ACTIVE_GENERAL_PRAYERS,
  CREATE_GENERAL_PRAYER,
  ENQUEUE_GENERAL_PRAYER_AUDIO_JOB,
  GET_GENERAL_PRAYER_BY_ID,
  GET_GENERAL_PRAYER_BY_SEQUENCE,
  GET_GENERAL_PRAYER_BY_SLUG,
  LIST_ACTIVE_GENERAL_PRAYERS,
  LIST_GENERAL_PRAYERS,
  UPDATE_GENERAL_PRAYER,
  type GeneralPrayerRow,
} from '@/providers/general-prayer'
import type {
  GeneralPrayerCreate,
  GeneralPrayerListQuery,
  GeneralPrayerOutput,
  GeneralPrayerSiteOutput,
  GeneralPrayerUpdate,
  MobileGeneralPrayer,
} from '@/models/general-prayer'

/*
 * General Prayer business logic (GP-API-02/04, GP-SITE-01/02, GP-MOB-01/02).
 *
 * Two audiences read the same rows:
 *   - staff, through the central admin screens, editing copy and audio;
 *   - everyone, through the public page and the mobile contract, reading the
 *     prayer this date maps to.
 *
 * Rules that matter:
 *   - `sequence` is the cycle position and is fixed after create: the public
 *     slug and the daily send both derive from it.
 *   - `body` is sanitised on WRITE (never trust the editor) and again on READ
 *     (rows can predate a sanitiser change).
 *   - a stale editor save is a 409, never a silent overwrite.
 */

const RESOURCE = 'general_prayer'

const notFound = () =>
  new GeneralError({
    code: 404,
    error: 'NOT_FOUND',
    error_code: 'RESOURCE_NOT_FOUND',
    details: 'General prayer not found.',
  })

const stale = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'STALE_VERSION',
    details: 'This prayer has changed. Refresh and try again.',
  })

const sequenceTaken = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'SEQUENCE_TAKEN',
    details: 'Another general prayer already holds that cycle position.',
    fields: { sequence: 'Already used.' },
  })

const audioInProgress = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'AUDIO_GENERATING',
    details: 'Audio is already being generated for this prayer.',
  })

const unknownLanguage = () =>
  new GeneralError({
    code: 422,
    error: 'VALIDATION_ERROR',
    error_code: 'UNKNOWN_LANGUAGE',
    details: 'Unknown or disabled language.',
    fields: { languageCode: 'Unknown or disabled.' },
  })

/** `CHAR(5)` columns come back space-padded; DTOs never carry the padding. */
const language = (code: string) => code.trim()

const audioUrlFor = (row: GeneralPrayerRow): string | null => {
  if (row.audio_status !== 'READY') return null
  if (!row.audio_asset || row.audio_asset.status !== 'READY') return null
  return S3_PUBLIC_URL({ key: row.audio_asset.object_key })
}

const durationFor = (row: GeneralPrayerRow): number | null => {
  if (!audioUrlFor(row)) return null
  return generatedAudioDurationSeconds(row.audio_asset?.byte_size)
}

const toOutput = (row: GeneralPrayerRow): GeneralPrayerOutput => ({
  id: row.id,
  slug: row.slug,
  sequence: row.sequence,
  title: row.title,
  introduction: row.introduction ? sanitizePrayerRichText(row.introduction) || null : null,
  body: sanitizePrayerRichText(row.body),
  verse: row.verse,
  verseReference: row.verse_reference,
  liturgicalNote: row.liturgical_note,
  references: row.references,
  languageCode: language(row.language_code),
  audioStatus: row.audio_status,
  audioAssetId: row.audio_asset_id,
  providerRequestId: row.provider_request_id,
  audioErrorCode: row.last_error_code,
  audioGeneratedAt: row.audio_generated_at ? row.audio_generated_at.toISOString() : null,
  isActive: row.is_active,
  version: row.version,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
})

const toSiteOutput = (row: GeneralPrayerRow): GeneralPrayerSiteOutput => ({
  slug: row.slug,
  sequence: row.sequence,
  title: row.title,
  introduction: row.introduction ? sanitizePrayerRichText(row.introduction) || null : null,
  body: sanitizePrayerRichText(row.body),
  verse: row.verse,
  verseReference: row.verse_reference,
  liturgicalNote: row.liturgical_note,
  references: row.references,
  languageCode: language(row.language_code),
  audioUrl: audioUrlFor(row),
  durationSeconds: durationFor(row),
})

/** Sanitised copy for a write. Empty string becomes null so the field is truly absent. */
const cleanCopy = (input: {
  title?: string
  introduction?: string | null
  verse?: string | null
  verseReference?: string | null
  liturgicalNote?: string | null
  references?: string | null
  body?: string
}) => {
  const optional = (value: string | null | undefined) => {
    if (value === undefined) return undefined
    if (value === null) return null
    const cleaned = sanitizePrayerRichText(value)
    return cleaned.length > 0 ? cleaned : null
  }
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    introduction: optional(input.introduction),
    verse: optional(input.verse),
    verseReference: input.verseReference === undefined ? undefined : input.verseReference || null,
    liturgicalNote: input.liturgicalNote === undefined ? undefined : input.liturgicalNote || null,
    references: input.references === undefined ? undefined : input.references || null,
    ...(input.body !== undefined ? { body: sanitizePrayerRichText(input.body) } : {}),
  }
}

const requireLanguage = async (code: string) => {
  const available = await GET_AVAILABLE_LANGUAGE_CODES({ codes: [code] })
  const known = Array.from(available).some((candidate) => candidate.trim() === code.trim())
  if (!known) throw unknownLanguage()
}

export const listGeneralPrayers = async ({
  query,
}: {
  query: GeneralPrayerListQuery
}): Promise<{ result: GeneralPrayerOutput[]; total: number }> => {
  const { result, total } = await LIST_GENERAL_PRAYERS({
    page: query.page,
    limit: query.limit,
    search: query.search,
    isActive: query.isActive,
  })
  return { result: result.map(toOutput), total }
}

export const getGeneralPrayer = async ({
  generalPrayerId,
}: {
  generalPrayerId: string
}): Promise<GeneralPrayerOutput> => {
  const row = await GET_GENERAL_PRAYER_BY_ID({ generalPrayerId })
  if (!row) throw notFound()
  return toOutput(row)
}

/** The slug is derived from the cycle position and never regenerated. */
const slugForSequence = (sequence: number) => `paivapalve-${sequence}`

export const createGeneralPrayer = async ({
  userId,
  input,
  requestId,
}: {
  userId: string
  input: GeneralPrayerCreate
  requestId: string
}): Promise<GeneralPrayerOutput> => {
  await requireLanguage(input.languageCode)
  const copy = cleanCopy(input)
  if (!copy.body || copy.body.length === 0) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'BODY_REQUIRED',
      details: 'Prayer text is required.',
      fields: { body: 'Required.' },
    })
  }

  try {
    const row = await CREATE_GENERAL_PRAYER({
      slug: slugForSequence(input.sequence),
      sequence: input.sequence,
      title: input.title,
      introduction: copy.introduction ?? null,
      body: copy.body,
      verse: copy.verse ?? null,
      verse_reference: copy.verseReference ?? null,
      liturgical_note: copy.liturgicalNote ?? null,
      references: copy.references ?? null,
      language_code: input.languageCode.trim(),
      is_active: input.isActive ?? true,
      created_by: userId,
    })
    await db.auditLog.create({
      data: auditPayload({
        actorId: userId,
        action: `${RESOURCE}.create`,
        resourceType: RESOURCE,
        resourceId: row.id,
        outcome: 'success',
        requestId,
      }),
    })
    return toOutput(row)
  } catch (error) {
    // Unique sequence/slug. Prisma has no typed error class here (driver adapters).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw sequenceTaken()
    }
    throw error
  }
}

export const updateGeneralPrayer = async ({
  userId,
  generalPrayerId,
  input,
  requestId,
}: {
  userId: string
  generalPrayerId: string
  input: GeneralPrayerUpdate
  requestId: string
}): Promise<GeneralPrayerOutput> => {
  if (input.languageCode !== undefined) await requireLanguage(input.languageCode)
  const copy = cleanCopy(input)

  if (copy.body !== undefined && copy.body.length === 0) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'BODY_REQUIRED',
      details: 'Prayer text is required.',
      fields: { body: 'Required.' },
    })
  }

  const current = await GET_GENERAL_PRAYER_BY_ID({ generalPrayerId })
  if (!current) throw notFound()

  const row = await UPDATE_GENERAL_PRAYER({
    generalPrayerId,
    expectedVersion: input.version,
    data: {
      ...(copy.title !== undefined ? { title: copy.title } : {}),
      ...(copy.introduction !== undefined ? { introduction: copy.introduction } : {}),
      ...(copy.verse !== undefined ? { verse: copy.verse } : {}),
      ...(copy.verseReference !== undefined ? { verse_reference: copy.verseReference } : {}),
      ...(copy.liturgicalNote !== undefined ? { liturgical_note: copy.liturgicalNote } : {}),
      ...(copy.references !== undefined ? { references: copy.references } : {}),
      ...(copy.body !== undefined
        ? {
            body: copy.body,
            // Edited text invalidates the generated audio: regenerate to match.
            audio_status: current.audio_asset_id ? current.audio_status : 'QUEUED',
          }
        : {}),
      ...(input.languageCode !== undefined ? { language_code: input.languageCode.trim() } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    },
  })
  if (!row) throw stale()

  await db.auditLog.create({
    data: auditPayload({
      actorId: userId,
      action: `${RESOURCE}.update`,
      resourceType: RESOURCE,
      resourceId: generalPrayerId,
      outcome: 'success',
      requestId,
    }),
  })
  return toOutput(row)
}

/**
 * POST audio: enqueue one `general_prayer.audio` row.
 *
 * Allowed from QUEUED / FAILED / READY (regeneration replaces the asset), never
 * while a generation is in flight.
 */
export const enqueueGeneralPrayerAudio = async ({
  generalPrayerId,
}: {
  generalPrayerId: string
}): Promise<GeneralPrayerOutput> => {
  const row = await GET_GENERAL_PRAYER_BY_ID({ generalPrayerId })
  if (!row) throw notFound()
  if (row.audio_status === 'GENERATING') throw audioInProgress()

  await ENQUEUE_GENERAL_PRAYER_AUDIO_JOB({ generalPrayerId, version: row.version })
  const updated = await GET_GENERAL_PRAYER_BY_ID({ generalPrayerId })
  return toOutput(updated ?? row)
}

/** Public detail by slug; an inactive prayer is not addressable. */
export const getGeneralPrayerBySlug = async ({
  slug,
}: {
  slug: string
}): Promise<GeneralPrayerSiteOutput | null> => {
  const row = await GET_GENERAL_PRAYER_BY_SLUG({ slug })
  return row ? toSiteOutput(row) : null
}

/** Cycle index: every active prayer in cycle order. */
export const listGeneralPrayerCycle = async (): Promise<{
  cycle: GeneralPrayerSiteOutput[]
  todaySequence: number | null
}> => {
  const rows = await LIST_ACTIVE_GENERAL_PRAYERS()
  if (rows.length === 0) return { cycle: [], todaySequence: null }
  const { dateISO } = todayInTallinn()
  return {
    cycle: rows.map(toSiteOutput),
    todaySequence: sequenceFor(dateISO, rows.length),
  }
}

/** The prayer the daily send delivers on `dateISO`, or null when the cycle is empty. */
export const getGeneralPrayerForDate = async ({
  dateISO,
}: {
  dateISO: string
}): Promise<{ row: GeneralPrayerSiteOutput; sequence: number } | null> => {
  const count = await COUNT_ACTIVE_GENERAL_PRAYERS()
  if (count === 0) return null
  const sequence = sequenceFor(dateISO, count)
  const row = await GET_GENERAL_PRAYER_BY_SEQUENCE({ sequence })
  return row ? { row: toSiteOutput(row), sequence } : null
}

/** Mobile contract payload for a date (GP-MOB-01). */
export const getMobileGeneralPrayer = async ({
  dateISO,
}: {
  dateISO: string
}): Promise<MobileGeneralPrayer | null> => {
  const today = await getGeneralPrayerForDate({ dateISO })
  if (!today) return null
  return {
    date: dateISO,
    ...today.row,
    sequence: today.sequence,
    nextResetAt: nextSendAt().toISOString(),
  }
}

/** Mobile deep link from an older push/email (GP-MOB-02). */
export const getMobileGeneralPrayerBySlug = async ({
  slug,
}: {
  slug: string
}): Promise<MobileGeneralPrayer | null> => {
  const row = await GET_GENERAL_PRAYER_BY_SLUG({ slug })
  if (!row) return null
  const { dateISO } = todayInTallinn()
  const count = await COUNT_ACTIVE_GENERAL_PRAYERS()
  const sequence = count > 0 ? sequenceFor(dateISO, count) : row.sequence
  const site = toSiteOutput(row)
  return {
    date: dateISO,
    ...site,
    // A row has a sequence; the cycle position for TODAY may differ from the
    // slug's own position after a wrap, so the day's position wins.
    sequence,
    nextResetAt: nextSendAt().toISOString(),
  }
}
