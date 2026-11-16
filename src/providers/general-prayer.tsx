import { Prisma } from '@prisma/client'
import { unstable_cache } from 'next/cache'
import { db } from '@/utils/db-connection'
import { withDbRetry } from '@/utils/db-resilience'
import { SITE_PUBLIC_REVALIDATE_SECONDS, SITE_PUBLIC_TAG } from '@/utils/site-cache-tags'

/*
 * General Prayer data adapter (GP-API-01). All Prisma access for the platform
 * daily-prayer content lives here — the controller owns validation, slug
 * generation and sanitisation, this file only moves rows.
 *
 * There is no tenancy filter: general prayers are platform content, not church
 * content (D-GP-6). Authorization is the route scope; the audience does not
 * narrow what a row IS.
 */

/** Public read projection: the audio asset's storage key + size feed the URL/duration. */
const ROW_SELECT = {
  id: true,
  slug: true,
  sequence: true,
  title: true,
  introduction: true,
  body: true,
  verse: true,
  verse_reference: true,
  liturgical_note: true,
  references: true,
  language_code: true,
  audio_status: true,
  audio_asset_id: true,
  provider_request_id: true,
  last_error_code: true,
  audio_generated_at: true,
  is_active: true,
  version: true,
  created_at: true,
  updated_at: true,
  audio_asset: { select: { object_key: true, byte_size: true, status: true } },
} satisfies Prisma.GeneralPrayerSelect

type RawRow = Prisma.GeneralPrayerGetPayload<{ select: typeof ROW_SELECT }>

/**
 * Row as the app sees it. `byte_size` is a Prisma `BigInt`, which JSON cannot
 * serialize — so the value is narrowed once here, at the provider boundary.
 * That also keeps the row cacheable (`unstable_cache` stores JSON).
 */
export type GeneralPrayerRow = Omit<RawRow, 'audio_asset'> & {
  audio_asset: { object_key: string; byte_size: number; status: string } | null
}

const toRow = (row: RawRow): GeneralPrayerRow => ({
  ...row,
  audio_asset: row.audio_asset
    ? {
        object_key: row.audio_asset.object_key,
        byte_size: Number(row.audio_asset.byte_size),
        status: row.audio_asset.status,
      }
    : null,
})

export const LIST_GENERAL_PRAYERS = async ({
  page,
  limit,
  search,
  isActive,
}: {
  page: number
  limit: number
  search?: string
  isActive?: boolean
}): Promise<{ result: GeneralPrayerRow[]; total: number }> => {
  const where: Prisma.GeneralPrayerWhereInput = {
    ...(isActive === undefined ? {} : { is_active: isActive }),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { body: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
  const [total, result] = await db.$transaction([
    db.generalPrayer.count({ where }),
    db.generalPrayer.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: [{ sequence: 'asc' }],
      select: ROW_SELECT,
    }),
  ])
  return { result: result.map(toRow), total }
}

export const GET_GENERAL_PRAYER_BY_ID = async ({
  generalPrayerId,
}: {
  generalPrayerId: string
}): Promise<GeneralPrayerRow | null> => {
  const row = await db.generalPrayer.findUnique({
    where: { id: generalPrayerId },
    select: ROW_SELECT,
  })
  return row ? toRow(row) : null
}

/** Cycle resolution: the active row at a position, or nothing. */
export const GET_GENERAL_PRAYER_BY_SEQUENCE = async ({
  sequence,
  activeOnly = true,
}: {
  sequence: number
  activeOnly?: boolean
}): Promise<GeneralPrayerRow | null> => {
  const row = await db.generalPrayer.findFirst({
    where: { sequence, ...(activeOnly ? { is_active: true } : {}) },
    select: ROW_SELECT,
  })
  return row ? toRow(row) : null
}

/**
 * Public read: an inactive prayer is not addressable (404), never a hidden 200.
 * Cached like the rest of the public site content — every visitor sees the same
 * row, and an admin write invalidates `SITE_PUBLIC_TAG`.
 */
export const GET_GENERAL_PRAYER_BY_SLUG = unstable_cache(
  withDbRetry(async ({ slug }: { slug: string }): Promise<GeneralPrayerRow | null> => {
    const row = await db.generalPrayer.findFirst({
      where: { slug, is_active: true },
      select: ROW_SELECT,
    })
    return row ? toRow(row) : null
  }),
  ['site-general-prayer-by-slug'],
  { revalidate: SITE_PUBLIC_REVALIDATE_SECONDS, tags: [SITE_PUBLIC_TAG] },
)

export const LIST_ACTIVE_GENERAL_PRAYERS = unstable_cache(
  withDbRetry(async (): Promise<GeneralPrayerRow[]> => {
    const rows = await db.generalPrayer.findMany({
      where: { is_active: true },
      orderBy: [{ sequence: 'asc' }],
      select: ROW_SELECT,
    })
    return rows.map(toRow)
  }),
  ['site-general-prayers'],
  { revalidate: SITE_PUBLIC_REVALIDATE_SECONDS, tags: [SITE_PUBLIC_TAG] },
)

/** Cycle length: the number of positions the date mapping may land on. */
export const COUNT_ACTIVE_GENERAL_PRAYERS = () =>
  db.generalPrayer.count({ where: { is_active: true } })

export const CREATE_GENERAL_PRAYER = async (
  data: Prisma.GeneralPrayerUncheckedCreateInput,
): Promise<GeneralPrayerRow> => toRow(await db.generalPrayer.create({ data, select: ROW_SELECT }))

/**
 * Optimistic update: the row only moves when `version` still matches, so a
 * stale editor cannot overwrite someone else's save. Returns the new row, or
 * null when the version was stale (the caller answers 409).
 */
export const UPDATE_GENERAL_PRAYER = async ({
  generalPrayerId,
  expectedVersion,
  data,
}: {
  generalPrayerId: string
  expectedVersion: number
  data: Prisma.GeneralPrayerUncheckedUpdateInput
}): Promise<GeneralPrayerRow | null> => {
  const updated = await db.generalPrayer.updateMany({
    where: { id: generalPrayerId, version: expectedVersion },
    data: { ...data, version: { increment: 1 }, updated_at: new Date() },
  })
  if (updated.count === 0) return null
  return GET_GENERAL_PRAYER_BY_ID({ generalPrayerId })
}

/**
 * Audio lifecycle write. `GENERATING` is entered only from a non-generating
 * state, so two workers cannot both synthesize the same prayer.
 */
export const SET_GENERAL_PRAYER_AUDIO = async ({
  generalPrayerId,
  status,
  assetId,
  providerRequestId,
  generatedAt,
  errorCode,
}: {
  generalPrayerId: string
  status: 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED'
  assetId?: string | null
  providerRequestId?: string | null
  generatedAt?: Date | null
  errorCode?: string | null
}) => {
  const data: Prisma.GeneralPrayerUncheckedUpdateInput = {
    audio_status: status,
    updated_at: new Date(),
    ...(assetId !== undefined ? { audio_asset_id: assetId } : {}),
    ...(providerRequestId !== undefined ? { provider_request_id: providerRequestId } : {}),
    ...(generatedAt !== undefined ? { audio_generated_at: generatedAt } : {}),
    ...(errorCode !== undefined ? { last_error_code: errorCode } : {}),
  }
  if (status === 'GENERATING') {
    return db.generalPrayer.updateMany({
      where: { id: generalPrayerId, audio_status: { not: 'GENERATING' } },
      data,
    })
  }
  return db.generalPrayer.updateMany({ where: { id: generalPrayerId }, data })
}

/**
 * One audio job per content version: the dedupe key ends in the row version, so
 * a double click on "Generate" is absorbed, and an edit (version bump) allows a
 * new generation for the new text.
 */
export const ENQUEUE_GENERAL_PRAYER_AUDIO_JOB = async ({
  generalPrayerId,
  version,
}: {
  generalPrayerId: string
  version: number
}) =>
  db.outboxJob.createMany({
    data: [
      {
        kind: 'general_prayer.audio',
        dedupe_key: `general_prayer.audio:${generalPrayerId}:${version}`,
        resource_id: generalPrayerId,
        payload: { version },
        available_at: new Date(),
      },
    ],
    skipDuplicates: true,
  })

/**
 * One send per calendar date, however often the sweep ticks: the unique dedupe
 * key is the guarantee, not the sweep's own "already exists" check.
 */
export const ENQUEUE_GENERAL_PRAYER_SEND_JOB = ({
  dateISO,
  generalPrayerId,
  availableAt,
}: {
  dateISO: string
  generalPrayerId: string
  availableAt: Date
}) =>
  db.outboxJob.createMany({
    data: [
      {
        kind: 'general_prayer.send',
        dedupe_key: `general_prayer.send:${dateISO}`,
        resource_id: generalPrayerId,
        payload: { date: dateISO },
        available_at: availableAt,
      },
    ],
    skipDuplicates: true,
  })
