import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/config/site-brand'

/*
 * Crawl rules. The site is mostly an authenticated app, so the default is deny:
 * only the public marketing + legal surfaces are allowed, and everything behind
 * the session stays out even though it also answers with a redirect.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/welcome', '/churches', '/privacy'],
        disallow: [
          '/dashboard',
          '/admin',
          '/customer',
          '/donations',
          '/api',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/verify-email',
          '/verify-account',
          '/maintenance',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
