import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/config/site-brand'
import { listPublicChurches } from '@/controller/mobile'
import { MobileChurchListQuerySchema } from '@/models/mobile'

// Regenerated hourly; the church listing itself is cached for 60s underneath.
export const revalidate = 3600

/*
 * Only public, non-redirecting URLs belong here. /terms and /cookies are
 * redirect() shims into /privacy, and everything else needs a session.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date()
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/welcome`, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/churches`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ]

  try {
    const churches: MetadataRoute.Sitemap = []
    // The list schema caps `limit` at 100, so walk pages until one comes back short.
    for (let page = 1; page <= 50; page++) {
      const query = MobileChurchListQuerySchema.parse({ page, limit: 100 })
      const { result } = await listPublicChurches({ query })
      for (const church of result) {
        if (!church.slug) continue
        churches.push({
          url: `${SITE_URL}/churches/${church.slug}`,
          lastModified,
          changeFrequency: 'monthly',
          priority: 0.6,
        })
      }
      if (result.length < 100) break
    }
    return [...pages, ...churches]
  } catch {
    // A DB-less build (container image, CI preview) must not fail on the sitemap.
    return pages
  }
}
