import PrayerArchive from '@/contents/site/prayers'
import { getSitePrayerArchive } from '@/controller/site-prayer'
import { SitePrayerArchiveQuerySchema } from '@/models/site-prayer'
import requiredWebAuth from '@/utils/required-webauth'
import { redirect } from 'next/navigation'

export default async function ChurchPrayerArchivePage({
  params,
}: {
  params: Promise<{ churchId: string }>
}) {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  const { churchId } = await params
  const query = SitePrayerArchiveQuerySchema.parse({})
  const archive = await getSitePrayerArchive({
    userId: web.session.user.user_id,
    query,
    fixedChurchId: churchId,
  })

  return (
    <PrayerArchive
      archive={archive}
      fixedChurchId={churchId}
      fixedChurchName={archive.churches[0]?.label}
      initialQuery={query}
      userId={web.session.user.user_id}
    />
  )
}
