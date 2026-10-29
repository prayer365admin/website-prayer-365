import { z } from 'zod'
import { richTextToPlainText } from '@/utils/rich-text-plain'

/*
 * Prayer DTOs (SPEC §6.2 / Tasks 21-25).
 *
 * PrayerInput drives both create (no `version`) and edit (requires `version`);
 * the route uses a refine so a PATCH without a version is rejected. PATCH
 * never mutates an approved snapshot — it creates a new immutable
 * PrayerVersion and repoints current_version_id.
 *
 * PrayerActionInput { version, prayerVersionId } gates every state transition
 * (text approval, audio approve, schedule, publish) on the prayer concurrency
 * version AND the exact immutable text snapshot.
 */

export const PrayerInputSchema = z
  .object({
    version: z.number().int().positive().optional(),
    title: z.string().trim().min(1).max(500),
    introduction: z.string().trim().max(4000).nullish(),
    body: z.string().trim().min(1).max(40000),
    pastorId: z.string().uuid(),
    languageCode: z.string().trim().min(1).max(10),
    featuredAssetId: z.string().uuid().nullish(),
  })
  .refine((value) => richTextToPlainText(value.body).length > 0, {
    message: 'Full prayer text is required.',
    path: ['body'],
  })
  .strict()

export type PrayerInput = z.infer<typeof PrayerInputSchema>

export const PrayerActionInputSchema = z
  .object({
    version: z.number().int().positive(),
    prayerVersionId: z.string().uuid(),
  })
  .strict()

export type PrayerActionInput = z.infer<typeof PrayerActionInputSchema>

export const PrayerAudioEnqueueInputSchema = z
  .object({
    version: z.number().int().positive(),
    prayerVersionId: z.string().uuid(),
    voiceProfileId: z.string().uuid(),
  })
  .strict()

export type PrayerAudioEnqueueInput = z.infer<typeof PrayerAudioEnqueueInputSchema>

export const ScheduleInputSchema = z
  .object({
    version: z.number().int().positive(),
    prayerVersionId: z.string().uuid(),
    scheduledAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict()

export type ScheduleInput = z.infer<typeof ScheduleInputSchema>

export const PublishInputSchema = z
  .object({
    version: z.number().int().positive(),
    prayerVersionId: z.string().uuid(),
  })
  .strict()

export type PublishInput = z.infer<typeof PublishInputSchema>

export const PrayerListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  order_by: z.enum(['created_at', 'published_at']).default('created_at'),
  order_direction: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(['current', 'archive']).optional(),
  search: z.string().trim().max(200).optional(),
})

export type PrayerListQuery = z.infer<typeof PrayerListQuerySchema>

export const PrayerVersionOutputSchema = z.object({
  id: z.string(),
  versionNumber: z.number(),
  pastorId: z.string(),
  title: z.string(),
  introduction: z.string().nullable(),
  body: z.string(),
  languageCode: z.string(),
  textHash: z.string(),
  approvedBy: z.string().nullable(),
  approvedByName: z.string().nullable().optional(),
  approvedAt: z.string().nullable(),
  selectedAudioId: z.string().nullable(),
  latestAudioId: z.string().nullable(),
  latestAudioStatus: z.string().nullable(),
  createdAt: z.string(),
})

export type PrayerVersionOutput = {
  id: string
  versionNumber: number
  pastorId: string
  title: string
  introduction: string | null
  body: string
  languageCode: string
  textHash: string
  approvedBy: string | null
  approvedByName?: string | null
  approvedAt: string | null
  selectedAudioId: string | null
  /**
   * Newest audio generated for this exact version (any status). Lets the editor
   * pick up a generation still running in the worker after a page reload.
   */
  latestAudioId: string | null
  latestAudioStatus: string | null
  createdAt: string
}

export const PrayerOutputSchema = z.object({
  id: z.string(),
  churchId: z.string(),
  version: z.number(),
  createdAt: z.string(),
  featuredAssetId: z.string().nullable(),
  current: PrayerVersionOutputSchema.nullable(),
  published: z.object({ prayerVersionId: z.string(), publishedAt: z.string() }).nullable(),
  scheduled: z.object({ prayerVersionId: z.string(), scheduledAt: z.string() }).nullable(),
  textApproved: z.boolean(),
})

/** Central (cross-church) row: the church list item plus the church name (plan 023). */
export const CentralPrayerOutputSchema = PrayerOutputSchema.extend({ churchName: z.string() })

/** Central list filters: the church list query plus an optional church narrowing. */
export const CentralPrayerListQuerySchema = PrayerListQuerySchema.extend({
  churchId: z.string().optional(),
})

export type CentralPrayerListQuery = z.infer<typeof CentralPrayerListQuerySchema>

export type PrayerOutput = {
  id: string
  churchId: string
  version: number
  createdAt: string
  featuredAssetId: string | null
  current: PrayerVersionOutput | null
  published: { prayerVersionId: string; publishedAt: string } | null
  scheduled: { prayerVersionId: string; scheduledAt: string } | null
  textApproved: boolean
}

export type CentralPrayerOutput = PrayerOutput & { churchName: string }

export const PrayerAudioOutputSchema = z.object({
  id: z.string(),
  prayerVersionId: z.string(),
  prayerId: z.string(),
  voiceProfileId: z.string(),
  status: z.string(),
  assetId: z.string().nullable(),
  providerRequestId: z.string().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  errorCode: z.string().nullable(),
  createdAt: z.string(),
})

export type PrayerAudioOutput = {
  id: string
  prayerVersionId: string
  prayerId: string
  voiceProfileId: string
  status: string
  assetId: string | null
  providerRequestId: string | null
  approvedBy: string | null
  approvedAt: string | null
  errorCode: string | null
  createdAt: string
}

export const mapVersion = (v: {
  id: string
  version_number: number
  pastor_id: string
  title: string
  introduction: string | null
  body: string
  language_code: string
  text_hash: string
  approved_by: string | null
  approved_at: Date | null
  selected_audio_id: string | null
  created_at: Date
  approved_by_user?: { name: string } | null
  /** Newest-first, at most one row (versionFields). Absent on write responses. */
  audio?: { id: string; status: string }[]
}): PrayerVersionOutput => ({
  id: v.id,
  versionNumber: v.version_number,
  pastorId: v.pastor_id,
  title: v.title,
  introduction: v.introduction,
  body: v.body,
  languageCode: v.language_code,
  textHash: v.text_hash,
  approvedBy: v.approved_by,
  approvedByName: v.approved_by_user?.name ?? null,
  approvedAt: v.approved_at ? v.approved_at.toISOString() : null,
  selectedAudioId: v.selected_audio_id,
  latestAudioId: v.audio?.[0]?.id ?? null,
  latestAudioStatus: v.audio?.[0]?.status ?? null,
  createdAt: v.created_at.toISOString(),
})
