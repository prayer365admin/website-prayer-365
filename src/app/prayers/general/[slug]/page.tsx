import ContentsSiteGeneralPrayerDetail from '@/contents/site/general-prayer/detail'
import { getGeneralPrayerBySlug } from '@/controller/general-prayer'
import { todayInTallinn } from '@/utils/general-prayer-cycle'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

// Public platform daily prayer (D-GP-7): no requiredWebAuth, crawlable.
// Hourly revalidation so an audio going READY is picked up without a deploy.
export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const prayer = await getGeneralPrayerBySlug({ slug }).catch(() => null)

  return prayer
    ? {
        title: prayer.title,
        alternates: { canonical: `/prayers/general/${slug}` },
        robots: { index: true, follow: true },
      }
    : { title: 'Prayer not found', robots: { index: false, follow: false } }
}

export default async function GeneralPrayerDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const prayer = await getGeneralPrayerBySlug({ slug })
  if (!prayer) notFound()

  // The label is the cycle day's send date (dd.MM.yyyy), never a weekday name.
  const { dateISO } = todayInTallinn()
  const [year, month, day] = dateISO.split('-')
  const sentOn = `${day}.${month}.${year}`

  return <ContentsSiteGeneralPrayerDetail prayer={prayer} sentOn={sentOn} />
}
