import { z } from 'zod'

/*
 * Event DTOs (SPEC §6.2 EventInput / Task 26).
 *
 * category is the fixed enum; startsAt must be an ISO datetime WITH a timezone
 * offset (no naive/ambiguous local time) — validated as UTC; registrationUrl
 * is allowlisted to https only; languageCode must reference an enabled
 * language (checked in the controller/provider). `version` is required on
 * PATCH (stale → 409) and omitted on create.
 */

export const EventCategorySchema = z.enum([
  'SERVICE',
  'SPECIAL',
  'BIBLE_STUDY',
  'COMMUNITY',
  'OTHER',
])

export type EventCategory = z.infer<typeof EventCategorySchema>

const utcOffset = (s: string) => {
  const m = /Z$|[+-]\d{2}:\d{2}$/.test(s)
  return m
}

export const EventInputSchema = z
  .object({
    version: z.number().int().positive().optional(),
    category: EventCategorySchema,
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().max(8000),
    startsAt: z
      .string()
      .trim()
      .refine((s) => z.iso.datetime({ offset: true }).safeParse(s).success, {
        message: 'startsAt must be an ISO 8601 datetime with an explicit timezone offset.',
      })
      .refine((s) => utcOffset(s) && !Number.isNaN(new Date(s).getTime()), {
        message: 'startsAt must be a valid UTC datetime (no naive/ambiguous local time).',
      }),
    location: z.string().trim().min(1).max(300),
    registrationUrl: z
      .string()
      .trim()
      .refine((s) => z.url().safeParse(s).success && s.toLowerCase().startsWith('https://'), {
        message: 'registrationUrl must be an https:// URL.',
      })
      .nullish(),
    languageCode: z.string().trim().min(1).max(10).nullish(),
  })
  .strict()

export type EventInput = z.infer<typeof EventInputSchema>
export type EventCreateInput = Omit<EventInput, 'version'> & { version?: never }
export type EventUpdateInput = EventInput & { version: number }

export const EventListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  order_by: z.enum(['starts_at', 'created_at', 'title']).default('starts_at'),
  order_direction: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().trim().max(200).optional(),
  category: EventCategorySchema.optional(),
  has_link: z.enum(['yes', 'no']).optional(),
  starts_from: z.iso.datetime({ offset: true }).optional(),
  starts_to: z.iso.datetime({ offset: true }).optional(),
})

export type EventListQuery = z.infer<typeof EventListQuerySchema>

export const EventOutputSchema = z.object({
  id: z.string(),
  churchId: z.string(),
  category: EventCategorySchema,
  title: z.string(),
  description: z.string(),
  startsAt: z.string(),
  location: z.string(),
  registrationUrl: z.string().nullable(),
  languageCode: z.string().nullable(),
  version: z.number(),
  createdAt: z.string(),
})

export type EventOutput = {
  id: string
  churchId: string
  category: EventCategory
  title: string
  description: string
  startsAt: string
  location: string
  registrationUrl: string | null
  languageCode: string | null
  version: number
  createdAt: string
}

export const mapEvent = (e: {
  id: string
  church_id: string
  category: string
  title: string
  description: string
  starts_at: Date
  location: string
  registration_url: string | null
  language_code: string | null
  version: number
  created_at: Date
}): EventOutput => ({
  id: e.id,
  churchId: e.church_id,
  category: e.category as EventCategory,
  title: e.title,
  description: e.description,
  startsAt: e.starts_at.toISOString(),
  location: e.location,
  registrationUrl: e.registration_url,
  languageCode: e.language_code,
  version: e.version,
  createdAt: e.created_at.toISOString(),
})
