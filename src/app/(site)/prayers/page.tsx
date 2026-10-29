import PrayerArchive from '@/contents/site/prayers'
import { getSitePrayerArchive } from '@/controller/site-prayer'
import { SitePrayerArchiveQuerySchema } from '@/models/site-prayer'
import requiredWebAuth from '@/utils/required-webauth'
import { redirect } from 'next/navigation'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function PrayerArchivePage({ searchParams }: { searchParams: SearchParams }) {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  const raw = await searchParams
  const query = SitePrayerArchiveQuerySchema.parse({
    churchId: first(raw.churchId),
  })
  const archive = await getSitePrayerArchive({ userId: web.session.user.user_id, query })

  return <PrayerArchive archive={archive} initialQuery={query} userId={web.session.user.user_id} />
}
