import { z } from 'zod'
import { ANNOUNCEMENT_STATUS } from '@/utils/constant'

/*
 * Announcement DTOs (SPEC §8.2 / Task 27, D12 resolved: minimal fields).
 * title + body only; publication is immediate (published_at = now) — no
 * arbitrary scheduling. `version` is required on PATCH/publish (stale → 409).
 */

export const AnnouncementInputSchema = z
  .object({
    version: z.number().int().positive().optional(),
    title: z.string().trim().min(1).max(500),
    body: z.string().trim().min(1).max(10000),
  })
  .strict()

export type AnnouncementInput = z.infer<typeof AnnouncementInputSchema>

export const AnnouncementPublishInputSchema = z
  .object({
    version: z.number().int().positive(),
  })
  .strict()

export type AnnouncementPublishInput = z.infer<typeof AnnouncementPublishInputSchema>

export const AnnouncementStatusSchema = z.enum(ANNOUNCEMENT_STATUS)

export type AnnouncementStatus = z.infer<typeof AnnouncementStatusSchema>

export const AnnouncementListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  order_by: z.enum(['created_at', 'title', 'published_at']).default('created_at'),
  order_direction: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().max(200).optional(),
  status: AnnouncementStatusSchema.optional(),
  published_from: z.iso.datetime({ offset: true }).optional(),
  published_to: z.iso.datetime({ offset: true }).optional(),
})

export type AnnouncementListQuery = z.infer<typeof AnnouncementListQuerySchema>

export const AnnouncementOutputSchema = z.object({
  id: z.string(),
  churchId: z.string(),
  title: z.string(),
  body: z.string(),
  publishedAt: z.string().nullable(),
  version: z.number(),
  createdAt: z.string(),
})

export type AnnouncementOutput = {
  id: string
  churchId: string
  title: string
  body: string
  publishedAt: string | null
  version: number
  createdAt: string
}

/** List rows carry their church so cross-church (central) lists can label and localise them. */
export const AnnouncementListItemSchema = AnnouncementOutputSchema.extend({
  church: z.object({ name: z.string(), timezone: z.string() }),
})

export type AnnouncementListItem = AnnouncementOutput & {
  church: { name: string; timezone: string }
}

export const mapAnnouncement = (a: {
  id: string
  church_id: string
  title: string
  body: string
  published_at: Date | null
  version: number
  created_at: Date
}): AnnouncementOutput => ({
  id: a.id,
  churchId: a.church_id,
  title: a.title,
  body: a.body,
  publishedAt: a.published_at ? a.published_at.toISOString() : null,
  version: a.version,
  createdAt: a.created_at.toISOString(),
})
