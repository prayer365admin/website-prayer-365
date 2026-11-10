import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ContentsSiteChurchProfile from '@/contents/site/church-profile'
import { getPublicChurch } from '@/controller/mobile'
import { churchJsonLd, churchMetadata } from '@/utils/church-structured-data'

// Public church profile on the SAME URL members already use. The row is fetched
// on the server (APPROVED-only, cached in the provider) so the church name,
// description and address are in the crawlable HTML; the client component then
// keeps the member controls for signed-in visitors.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const church = await getPublicChurch({ slug }).catch(() => null)

  return church
    ? churchMetadata(church)
    : { title: 'Church not found', robots: { index: false, follow: false } }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const church = await getPublicChurch({ slug }).catch(() => null)
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
