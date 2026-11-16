import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ContentsSiteChurchProfile from '@/contents/site/church-profile'
import { getPublicChurch } from '@/controller/mobile'
import { churchJsonLd, churchMetadata } from '@/utils/church-structured-data'

// Public church profile on the SAME URL members already use. The row is fetched
// on the server (APPROVED-only, cached in the provider) so the church name,
// description and address are in the crawlable HTML; the client component then
// keeps the member controls for signed-in visitors.
//
// A missing church throws Next's notFound() from the controller, so it renders a
// real 404. Database failures are NOT swallowed: they bubble to the error
// boundary (500) instead of telling crawlers the church is gone — production
// served 404s for reachable churches on 16 Nov 2026 when the connection pool
// timed out.

const isNextNotFound = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { digest?: unknown }).digest === 'NEXT_NOT_FOUND'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const church = await getPublicChurch({ slug }).catch((error: unknown) => {
    if (isNextNotFound(error)) return null
    throw error
  })

  return church
    ? churchMetadata(church)
    : { title: 'Church not found', robots: { index: false, follow: false } }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const church = await getPublicChurch({ slug })
  if (!church) notFound()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(churchJsonLd(church)) }}
      />
      <ContentsSiteChurchProfile slug={church.slug} initialChurch={church} />
    </>
  )
}
