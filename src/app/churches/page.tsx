import { SITE_NAME } from '@/config/site-brand'
import ContentsSiteChurchDirectory from '@/contents/site/church-directory'
import requiredWebAuth from '@/utils/required-webauth'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Churches & Parishes',
  description: `Browse the churches and parishes of the ${SITE_NAME} fellowship — addresses, denominations and service times.`,
  alternates: { canonical: '/churches' },
  // Member-only surface: the church list needs a session, so it must not be indexed.
  robots: { index: false, follow: false },
}

/*
 * The interactive directory (search, map, pagination) reads a session-scoped API,
 * so this page is member-only: a guest is sent to /welcome exactly like every page
 * in the `(site)` group. The public, crawlable church surface is /churches/[slug],
 * which fetches its row on the server.
 */
export default async function Page() {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/welcome')

  return <ContentsSiteChurchDirectory />
}
