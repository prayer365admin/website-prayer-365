import { z } from 'zod'

/*
 * Church DTOs (SPEC §6.2 ChurchProfileInput + Task 12/13).
 * The profile schema uses `.strict()` so server-owned fields the UI must not
 * write (status, approved_by, approved_at, ...) are rejected with 422 instead
 * of being silently stripped. Coordinates are validated both-or-null and
 * within geographic range; coverAssetId is a UUID that the controller verifies
 * belongs to this church and is READY.
 */

export const CoordinatesSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict()

export const ChurchAddressSchema = z
  .object({
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().max(50).optional(),
    countryCode: z.string().length(2),
  })
  .strict()

export const ChurchContactsSchema = z
  .object({
    email: z.email().optional(),
    phone: z.string().trim().max(50).optional(),
  })
  .strict()

export const SocialLinkSchema = z
  .object({
    label: z.string().trim().min(1).max(100),
    url: z.string().trim().min(1).max(500),
  })
  .strict()

export const ChurchProfileInputSchema = z
  .object({
    version: z.number().int().positive(),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).nullish(),
    denomination: z.string().trim().max(200).nullish(),
    address: ChurchAddressSchema,
    coordinates: CoordinatesSchema.nullish(),
    timezone: z.string().trim().min(1).max(64),
    contacts: ChurchContactsSchema,
    website: z.url().nullish().or(z.literal('').nullable()),
    socialLinks: z.array(SocialLinkSchema).max(50).default([]),
    languageCodes: z.array(z.string().trim().min(1).max(10)).max(50),
    accessibility: z.string().trim().max(2000).nullish(),
    coverAssetId: z.string().uuid().nullish(),
  })
  .strict()

export type ChurchProfileInput = z.infer<typeof ChurchProfileInputSchema>

export const ChurchProfileOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  denomination: z.string().nullable(),
  address: z.unknown(),
  coordinates: CoordinatesSchema.nullable(),
  timezone: z.string(),
  contacts: z.unknown(),
  website: z.string().nullable(),
  socialLinks: z.unknown(),
  languageCodes: z.array(z.string()),
  accessibility: z.string().nullable(),
  coverAssetId: z.string().nullable(),
  status: z.string(),
  version: z.number(),
})

export type ChurchProfileOutput = {
  id: string
  name: string
  description: string | null
  denomination: string | null
  address: unknown
  coordinates: { latitude: number; longitude: number } | null
  timezone: string
  contacts: unknown
  website: string | null
  socialLinks: unknown
  languageCodes: string[]
  accessibility: string | null
  coverAssetId: string | null
  status: string
  version: number
}

export const ChurchSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  timezone: z.string(),
  city: z.string().nullable(),
  version: z.number(),
})

export type ChurchSummary = {
  id: string
  name: string
  status: string
  timezone: string
  city: string | null
  version: number
}

export const ChurchOverviewSchema = z.object({
  church: ChurchSummarySchema,
  aggregates: z.object({
    serviceTimeCount: z.number(),
    pastorCount: z.number(),
    prayerCount: z.number(),
    eventCount: z.number(),
    announcementCount: z.number(),
    memberCount: z.number(),
    mediaCount: z.number(),
  }),
  requests: z
    .object({
      total: z.number(),
      recent: z.array(
        z.object({
          id: z.string(),
          kind: z.string(),
          classification: z.string().nullable(),
          createdAt: z.date(),
        }),
      ),
    })
    .optional(),
})

export type ChurchOverviewAggregates = {
  serviceTimeCount: number
  pastorCount: number
  prayerCount: number
  eventCount: number
  announcementCount: number
  memberCount: number
  mediaCount: number
}

export interface ChurchOverview {
  church: ChurchSummary
  aggregates: ChurchOverviewAggregates
  requests?: {
    total: number
    recent: Array<{ id: string; kind: string; classification: string | null; createdAt: Date }>
  }
}

export const ChurchListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().trim().max(200).optional(),
  order_by: z.enum(['name', 'created_at']).default('name'),
  order_direction: z.enum(['asc', 'desc']).default('asc'),
})

export type ChurchListQuery = z.infer<typeof ChurchListQuerySchema>
