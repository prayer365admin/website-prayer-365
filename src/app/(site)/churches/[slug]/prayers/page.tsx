import PrayerArchive from '@/contents/site/prayers'
import { getSitePrayerArchive } from '@/controller/site-prayer'
import { SitePrayerArchiveQuerySchema } from '@/models/site-prayer'
import requiredWebAuth from '@/utils/required-webauth'
import { redirect } from 'next/navigation'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function ChurchPrayerArchivePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: SearchParams
}) {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  const [{ slug }, raw] = await Promise.all([params, searchParams])
  const query = SitePrayerArchiveQuerySchema.parse({
    page: first(raw.page),
    limit: 6,
    search: first(raw.search),
    language: first(raw.language),
    format: first(raw.format),
  })
  const archive = await getSitePrayerArchive({
    userId: web.session.user.user_id,
    query,
    fixedChurchSlug: slug,
  })

  return (
    <PrayerArchive
      archive={archive}
      basePath={`/churches/${slug}/prayers`}
      fixedChurchName={archive.churches[0]?.label}
      query={query}
    />
  )
}
