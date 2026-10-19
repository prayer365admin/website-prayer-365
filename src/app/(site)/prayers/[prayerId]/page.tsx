import PrayerDetail from '@/contents/site/prayer-detail'
import { getSitePrayerDetail } from '@/controller/site-prayer'
import requiredWebAuth from '@/utils/required-webauth'
import { notFound, redirect } from 'next/navigation'

export default async function PrayerDetailPage({
  params,
}: {
  params: Promise<{ prayerId: string }>
}) {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  const { prayerId } = await params
  const detail = await getSitePrayerDetail({ prayerId })
  if (!detail) notFound()

  return <PrayerDetail detail={detail} />
}
