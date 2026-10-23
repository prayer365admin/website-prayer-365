import PrayerDetail from '@/contents/site/prayer-detail'
import { getSitePrayerDetail } from '@/controller/site-prayer'
import requiredWebAuth from '@/utils/required-webauth'
import { notFound, redirect } from 'next/navigation'

export default async function PrayerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  const { slug } = await params
  const detail = await getSitePrayerDetail({ prayerSlug: slug })
  if (!detail) notFound()

  // Preserve old bookmarked ID routes while ensuring the visible URL is canonical.
  if (slug !== detail.prayer.slug) redirect(`/prayers/${detail.prayer.slug}`)

  return <PrayerDetail detail={detail} userId={web.session.user.user_id} />
}
