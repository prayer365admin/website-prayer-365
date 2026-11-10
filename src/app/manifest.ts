import type { MetadataRoute } from 'next'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, THEME_COLOR } from '@/config/site-brand'

/*
 * Web app manifest. Icon paths point into /public on purpose: Next serves the
 * app/ file-convention icons from hashed URLs (/icon?<hash>), which a manifest
 * cannot reference stably.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — ${SITE_TAGLINE}`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/welcome',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: THEME_COLOR,
    icons: [
      { src: '/icons/app/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/app/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
