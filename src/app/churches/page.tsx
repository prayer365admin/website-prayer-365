import { SITE_NAME } from '@/config/site-brand'
import ContentsSiteChurchDirectory from '@/contents/site/church-directory'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Churches & Parishes',
  description: `Browse the churches and parishes of the ${SITE_NAME} fellowship — addresses, denominations and service times.`,
  alternates: { canonical: '/churches' },
  robots: { index: true, follow: true },
}

/*
 * The interactive directory (search, map, pagination) stays a client component.
 * The plain link list underneath exists so the church URLs are real anchors in
 * the server HTML — a crawler needs them, and the sitemap only covers discovery.
 */
export default async function Page() {
  return (
    <>
      <ContentsSiteChurchDirectory />
    </>
  )
}
