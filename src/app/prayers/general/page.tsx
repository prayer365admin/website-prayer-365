import ContentsSiteGeneralPrayerCycle from '@/contents/site/general-prayer'
import { listGeneralPrayerCycle } from '@/controller/general-prayer'
import type { Metadata } from 'next'

// Public platform daily-prayer cycle (D-GP-7): no requiredWebAuth, crawlable.
// Revalidated hourly so the "today" marker follows the 07:00 Tallinn send.
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'General Prayer',
  alternates: { canonical: '/prayers/general' },
  robots: { index: true, follow: true },
}

export default async function GeneralPrayerCyclePage() {
  // A DB-less build (container image, CI preview) renders the empty message, not a crash.
  const { cycle, todaySequence } = await listGeneralPrayerCycle().catch(() => ({
    cycle: [],
    todaySequence: null,
  }))

  return <ContentsSiteGeneralPrayerCycle cycle={cycle} todaySequence={todaySequence} />
}
