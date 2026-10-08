import { z } from 'zod'

/*
 * Mobile shared backend DTOs (SPEC §8.4 / Tasks 39-43).
 *
 * - Discovery/public content is served ONLY for APPROVED churches and ONLY
 *   published/published content. Draft/current prayer snapshots, un-approved
 *   audio, suspended/archived churches are never exposed.
 * - Private fields (approved_by, approved_at, payment/balance) never appear
 *   in any output schema.
 * - Registered OpenAPI schemas are plain z.object (no .refine wrappers) so
 *   the openapi registry can embed them; cross-field rules (e.g. "subject
 *   required for prayer") are enforced in the controller, not the schema.
 */

// ---------------------------------------------------------------------------
// Public church discovery / profile (Task 39)
// ---------------------------------------------------------------------------

export const MobileCoordinatesSchema = z
  .object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })
  .strict()

export const MobilePublicAddressSchema = z
  .object({
    line1: z.string(),
    line2: z.string().nullable(),
    city: z.string(),
    postalCode: z.string().nullable(),
    countryCode: z.string(),
  })
  .strict()

export const MobilePublicContactsSchema = z
  .object({
    email: z.string().nullable(),
    phone: z.string().nullable(),
  })
  .strict()

export const MobileSocialLinkSchema = z.object({ label: z.string(), url: z.string() }).strict()

export const MobileServiceTimeSchema = z
  .object({
    weekday: z.number(),
    localTime: z.string(),
    label: z.string().nullable(),
    languageCode: z.string().nullable(),
  })
  .strict()

/** Public summary row in discovery lists. */
export const MobileChurchSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  denomination: z.string().nullable(),
  city: z.string().nullable(),
  coverAssetId: z.string().nullable(),
  distanceKm: z.number().nullable(),
})

export type MobileChurchSummary = z.infer<typeof MobileChurchSummarySchema>

/** Public church profile — deliberately omits approved_by/at, status gates, payment. */
export const MobilePublicChurchSchema = z.object({
  id: z.string(),
  name: z.string(),
  denomination: z.string().nullable(),
  description: z.string().nullable(),
  timezone: z.string(),
  address: MobilePublicAddressSchema,
  coordinates: MobileCoordinatesSchema.nullable(),
  contacts: MobilePublicContactsSchema,
  website: z.string().nullable(),
  socialLinks: z.array(MobileSocialLinkSchema),
  accessibility: z.string().nullable(),
  coverAssetId: z.string().nullable(),
  languageCodes: z.array(z.string()),
  serviceTimes: z.array(MobileServiceTimeSchema),
  distanceKm: z.number().nullable(),
})

export type MobilePublicChurch = z.infer<typeof MobilePublicChurchSchema>

export const MobileChurchListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().trim().max(200).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
})

export type MobileChurchListQuery = z.infer<typeof MobileChurchListQuerySchema>

// ---------------------------------------------------------------------------
// Home / me / churches / follows (Task 40)
// ---------------------------------------------------------------------------

export const MobileMeSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  locale: z.string().nullable(),
  profilePicture: z.string().nullable(),
  mainChurchId: z.string().nullable(),
})

export type MobileMe = z.infer<typeof MobileMeSchema>

export const MobileMePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    locale: z.string().trim().max(10).nullable().optional(),
    mainChurchId: z.string().uuid().nullable().optional(),
    profilePicture: z.string().trim().url().max(2048).nullable().optional(),
  })
  .strict()

export type MobileMePatch = z.infer<typeof MobileMePatchSchema>

export const MobileMyChurchSchema = z.object({
  churchId: z.string(),
  churchName: z.string(),
  city: z.string().nullable(),
  coverAssetId: z.string().nullable(),
  isMain: z.boolean(),
  isFollowed: z.boolean(),
})

export type MobileMyChurch = z.infer<typeof MobileMyChurchSchema>

export const MobileHomeSchema = z.object({
  mainChurch: MobilePublicChurchSchema.nullable(),
  followedChurches: z.array(MobileChurchSummarySchema),
  latestPrayers: z.array(z.unknown()).default([]),
  latestEvents: z.array(z.unknown()).default([]),
  latestAnnouncements: z.array(z.unknown()).default([]),
})

export type MobileHome = {
  mainChurch: MobilePublicChurch | null
  followedChurches: MobileChurchSummary[]
  latestPrayers: unknown[]
  latestEvents: unknown[]
  latestAnnouncements: unknown[]
}

// ---------------------------------------------------------------------------
// Published content (Tasks 41/42)
// ---------------------------------------------------------------------------

export const MobilePublishedAudioSchema = z.object({
  prayerAudioId: z.string(),
  assetId: z.string().nullable(),
  assetKey: z.string().nullable(),
  approvedAt: z.string(),
})

export type MobilePublishedAudio = z.infer<typeof MobilePublishedAudioSchema>

export const MobilePublishedPrayerSchema = z.object({
  id: z.string(),
  churchId: z.string(),
  publishedAt: z.string(),
  version: z.object({
    prayerVersionId: z.string(),
    versionNumber: z.number(),
    pastorId: z.string(),
    title: z.string(),
    introduction: z.string().nullable(),
    body: z.string(),
    languageCode: z.string(),
  }),
  audio: MobilePublishedAudioSchema.nullable(),
})

export type MobilePublishedPrayer = {
  id: string
  churchId: string
  publishedAt: string
  version: {
    prayerVersionId: string
    versionNumber: number
    pastorId: string
    title: string
    introduction: string | null
    body: string
    languageCode: string
  }
  audio: MobilePublishedAudio | null
}

export const MobilePrayerListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
})

export type MobilePrayerListQuery = z.infer<typeof MobilePrayerListQuerySchema>

export const MobilePublicEventSchema = z.object({
  id: z.string(),
  churchId: z.string(),
  category: z.string(),
  title: z.string(),
  description: z.string(),
  startsAt: z.string(),
  location: z.string(),
  registrationUrl: z.string().nullable(),
  languageCode: z.string().nullable(),
})

export type MobilePublicEvent = {
  id: string
  churchId: string
  category: string
  title: string
  description: string
  startsAt: string
  location: string
  registrationUrl: string | null
  languageCode: string | null
}

export const MobileEventListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  category: z.string().optional(),
})

export type MobileEventListQuery = z.infer<typeof MobileEventListQuerySchema>

export const MobilePublicAnnouncementSchema = z.object({
  id: z.string(),
  churchId: z.string(),
  title: z.string(),
  body: z.string(),
  publishedAt: z.string(),
})

export type MobilePublicAnnouncement = {
  id: string
  churchId: string
  title: string
  body: string
  publishedAt: string
}

export const MobileAnnouncementListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
})

export type MobileAnnouncementListQuery = z.infer<typeof MobileAnnouncementListQuerySchema>

// ---------------------------------------------------------------------------
// Intake: requests, check-ins, analytics (Task 43)
// ---------------------------------------------------------------------------

export const MOBILE_REQUEST_KINDS = ['prayer', 'pastoral', 'meeting'] as const

/** Subject is enforced required-for-prayer in the controller (schema stays plain). */
export const MobileRequestInputSchema = z
  .object({
    kind: z.enum(MOBILE_REQUEST_KINDS),
    subject: z.string().trim().max(300).optional(),
    message: z.string().trim().min(1).max(10000),
    classification: z.enum(['PRIVATE', 'STANDARD']).optional(),
    contactMethod: z.string().trim().max(100).default('in_app'),
    phone: z.string().trim().max(50).nullable().optional(),
    email: z.string().trim().max(200).nullable().optional(),
    availability: z.string().trim().max(300).nullable().optional(),
  })
  .strict()

export type MobileRequestInput = z.infer<typeof MobileRequestInputSchema>

export const MobileRequestAckSchema = z.object({
  id: z.string(),
  kind: z.string(),
  createdAt: z.string(),
})

export type MobileRequestAck = z.infer<typeof MobileRequestAckSchema>

export const MobileCheckInInputSchema = z
  .object({
    // minimal; the church and user come from the route + auth
    localDate: z.string().optional(),
  })
  .strict()

export type MobileCheckInInput = z.infer<typeof MobileCheckInInputSchema>

export const MobileCheckInAckSchema = z.object({
  id: z.string(),
  churchId: z.string(),
  occurredAt: z.string(),
  localDate: z.string(),
})

export type MobileCheckInAck = z.infer<typeof MobileCheckInAckSchema>

/** Analytics event type allowlist (bounded, no arbitrary payload). */
export const MOBILE_ANALYTICS_TYPES = [
  'app_open',
  'home_view',
  'church_view',
  'prayer_view',
  'prayer_listen',
  'event_view',
  'announcement_view',
  'search',
  'donate_click',
  'checkin_complete',
  'notification_opened',
] as const

export const MOBILE_ANALYTICS_MAX_BATCH = 50

export const MobileAnalyticsEventSchema = z
  .object({
    eventKey: z.string().trim().min(1).max(200).optional(),
    eventType: z.enum(MOBILE_ANALYTICS_TYPES),
    occurredAt: z.iso.datetime({ offset: true }),
    churchId: z.string().uuid().nullable().optional(),
    resourceId: z.string().trim().max(200).nullable().optional(),
  })
  .strict()

export type MobileAnalyticsEvent = z.infer<typeof MobileAnalyticsEventSchema>

export const MobileAnalyticsInputSchema = z
  .object({
    events: z.array(MobileAnalyticsEventSchema).min(1).max(MOBILE_ANALYTICS_MAX_BATCH),
  })
  .strict()

export type MobileAnalyticsInput = z.infer<typeof MobileAnalyticsInputSchema>

export const MobileAnalyticsAckSchema = z.object({
  accepted: z.number(),
})

export type MobileAnalyticsAck = z.infer<typeof MobileAnalyticsAckSchema>
