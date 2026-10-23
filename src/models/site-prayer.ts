import { z } from 'zod'

export const SitePrayerArchiveQuerySchema = z.object({
  page: z.coerce.number().int().positive().catch(1).default(1),
  limit: z.coerce.number().int().min(1).max(24).catch(6).default(6),
  search: z.string().trim().max(200).catch('').default(''),
  churchId: z.string().trim().max(100).catch('').default(''),
  language: z.string().trim().max(10).catch('').default(''),
  format: z.enum(['all', 'audio', 'text']).catch('all').default('all'),
})

export type SitePrayerArchiveQuery = z.infer<typeof SitePrayerArchiveQuerySchema>

export type SitePrayerArchiveItem = {
  id: string
  churchId: string
  churchName: string
  publishedAt: string
  pastorId: string
  pastorName: string
  pastorBio: string | null
  pastorRole: string | null
  pastorImageUrl: string | null
  title: string
  introduction: string | null
  body: string
  languageCode: string
  audio: {
    prayerAudioId: string
    url: string
    approvedAt: string
  } | null
}

export type SitePrayerArchiveOption = { value: string; label: string; slug?: string }

export type SitePrayerArchive = {
  result: SitePrayerArchiveItem[]
  featured: SitePrayerArchiveItem | null
  total: number
  page: number
  limit: number
  totalPages: number
  churches: SitePrayerArchiveOption[]
  languages: string[]
}

export type SitePrayerDetail = {
  prayer: SitePrayerArchiveItem
  church: { id: string; slug: string; name: string; city: string | null }
  related: SitePrayerArchiveItem[]
}
