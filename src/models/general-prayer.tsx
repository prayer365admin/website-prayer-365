import { z } from 'zod'
import { richTextToPlainText } from '@/utils/rich-text-plain'

/*
 * General Prayer DTOs (GP-API-02). Platform content: no church, no pastor, no
 * voice profile — a cycle entry, its text, and its generated audio.
 *
 * `sequence` is the cycle position and is immutable after create: a public slug
 * (`paivapalve-<sequence>`) and the daily send both key off it, so renumbering
 * would silently republish different content on already-shared links.
 */

const plainText = (value: string) => richTextToPlainText(value).length > 0

export const GeneralPrayerListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().trim().max(200).optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .optional(),
})

export type GeneralPrayerListQuery = z.infer<typeof GeneralPrayerListQuerySchema>

/**
 * Create-time copy fields. `languageCode` defaults to Estonian because the
 * delivered content is Estonian; the UPDATE schema must not inherit that
 * default — a defaulted field is indistinguishable from an edited one, so a
 * title-only save would silently rewrite the language.
 */
const copyFields = {
  title: z.string().trim().min(1).max(500),
  introduction: z.string().trim().max(4000).nullish(),
  verse: z.string().trim().max(4000).nullish(),
  verseReference: z.string().trim().max(500).nullish(),
  liturgicalNote: z.string().trim().max(500).nullish(),
  references: z.string().trim().max(2000).nullish(),
  body: z
    .string()
    .trim()
    .min(1)
    .max(40000)
    .refine(plainText, { message: 'Prayer text is required.' }),
  languageCode: z.string().trim().min(2).max(5).default('et'),
  isActive: z.boolean().optional(),
}

export const GeneralPrayerCreateSchema = z
  .object({
    ...copyFields,
    sequence: z.number().int().positive().max(10_000),
  })
  .strict()

export type GeneralPrayerCreate = z.infer<typeof GeneralPrayerCreateSchema>

const updateFields = {
  title: copyFields.title,
  introduction: copyFields.introduction,
  verse: copyFields.verse,
  verseReference: copyFields.verseReference,
  liturgicalNote: copyFields.liturgicalNote,
  references: copyFields.references,
  body: copyFields.body,
  languageCode: z.string().trim().min(2).max(5),
  isActive: copyFields.isActive,
}

export const GeneralPrayerUpdateSchema = z
  .object({
    version: z.number().int().positive(),
    ...updateFields,
  })
  .partial({ title: true, body: true, languageCode: true })
  .strict()
  .refine(
    (value) =>
      value.title !== undefined ||
      value.body !== undefined ||
      value.introduction !== undefined ||
      value.verse !== undefined ||
      value.verseReference !== undefined ||
      value.liturgicalNote !== undefined ||
      value.references !== undefined ||
      value.languageCode !== undefined ||
      value.isActive !== undefined,
    { message: 'Provide at least one field to update.' },
  )

export type GeneralPrayerUpdate = z.infer<typeof GeneralPrayerUpdateSchema>

export const GENERAL_PRAYER_AUDIO_STATUSES = ['QUEUED', 'GENERATING', 'READY', 'FAILED'] as const
export type GeneralPrayerAudioStatus = (typeof GENERAL_PRAYER_AUDIO_STATUSES)[number]

export const GeneralPrayerOutputSchema = z.object({
  id: z.string(),
  slug: z.string(),
  sequence: z.number(),
  title: z.string(),
  introduction: z.string().nullable(),
  body: z.string(),
  verse: z.string().nullable(),
  verseReference: z.string().nullable(),
  liturgicalNote: z.string().nullable(),
  references: z.string().nullable(),
  languageCode: z.string(),
  audioStatus: z.string(),
  audioAssetId: z.string().nullable(),
  providerRequestId: z.string().nullable(),
  audioErrorCode: z.string().nullable(),
  audioGeneratedAt: z.string().nullable(),
  isActive: z.boolean(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
})

export type GeneralPrayerOutput = z.infer<typeof GeneralPrayerOutputSchema>

/** Cycle row as the public site and the mobile contract read it. */
export const GeneralPrayerSiteOutputSchema = z.object({
  slug: z.string(),
  sequence: z.number(),
  title: z.string(),
  introduction: z.string().nullable(),
  body: z.string(),
  verse: z.string().nullable(),
  verseReference: z.string().nullable(),
  liturgicalNote: z.string().nullable(),
  references: z.string().nullable(),
  languageCode: z.string(),
  audioUrl: z.string().nullable(),
  durationSeconds: z.number().nullable(),
})

export type GeneralPrayerSiteOutput = z.infer<typeof GeneralPrayerSiteOutputSchema>

/** Wire shape of `M/general-prayers/*` (plan GP-MOB-01 / MB-19). */
export const MobileGeneralPrayerSchema = z.object({
  date: z.string(),
  sequence: z.number(),
  slug: z.string(),
  title: z.string(),
  introduction: z.string().nullable(),
  verse: z.string().nullable(),
  verseReference: z.string().nullable(),
  liturgicalNote: z.string().nullable(),
  body: z.string(),
  references: z.string().nullable(),
  languageCode: z.string(),
  audioUrl: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  nextResetAt: z.string(),
})

export type MobileGeneralPrayer = z.infer<typeof MobileGeneralPrayerSchema>
