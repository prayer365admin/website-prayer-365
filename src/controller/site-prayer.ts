import { SitePrayerArchive, SitePrayerArchiveQuery, SitePrayerDetail } from '@/models/site-prayer'
import { GET_SITE_PRAYER_ARCHIVE, GET_SITE_PRAYER_DETAIL } from '@/providers/site-prayer'

export const getSitePrayerArchive = ({
  userId,
  query,
  fixedChurchId,
}: {
  userId: string
  query: SitePrayerArchiveQuery
  fixedChurchId?: string
}): Promise<SitePrayerArchive> => GET_SITE_PRAYER_ARCHIVE({ userId, query, fixedChurchId })

/** Published prayer of any approved church, or null (page renders 404). */
export const getSitePrayerDetail = ({
  prayerId,
}: {
  prayerId: string
}): Promise<SitePrayerDetail | null> => GET_SITE_PRAYER_DETAIL({ prayerId })
