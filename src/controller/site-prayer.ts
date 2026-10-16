import { SitePrayerArchive, SitePrayerArchiveQuery } from '@/models/site-prayer'
import { GET_SITE_PRAYER_ARCHIVE } from '@/providers/site-prayer'

export const getSitePrayerArchive = ({
  userId,
  query,
  fixedChurchId,
}: {
  userId: string
  query: SitePrayerArchiveQuery
  fixedChurchId?: string
}): Promise<SitePrayerArchive> => GET_SITE_PRAYER_ARCHIVE({ userId, query, fixedChurchId })
