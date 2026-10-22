import { SitePrayerArchive, SitePrayerArchiveQuery } from '@/models/site-prayer'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import axios from 'axios'

const queryKey = (query: SitePrayerArchiveQuery, fixedChurchId?: string) => [
  'site',
  'prayer-archive',
  fixedChurchId ?? query.churchId,
  query.page,
  query.limit,
  query.search,
  query.language,
  query.duration,
  query.format,
]

const sameQuery = (left: SitePrayerArchiveQuery, right: SitePrayerArchiveQuery) =>
  JSON.stringify(left) === JSON.stringify(right)

export const useSitePrayerArchive = ({
  query,
  initialQuery,
  initialData,
  fixedChurchId,
}: {
  query: SitePrayerArchiveQuery
  initialQuery: SitePrayerArchiveQuery
  initialData: SitePrayerArchive
  fixedChurchId?: string
}) => {
  const params = {
    page: query.page,
    limit: query.limit,
    search: query.search || undefined,
    language: query.language || undefined,
    duration: query.duration === 'all' ? undefined : query.duration,
    format: query.format === 'all' ? undefined : query.format,
    ...(!fixedChurchId && query.churchId ? { churchId: query.churchId } : {}),
  }
  const url = fixedChurchId
    ? `/api/v1/site/churches/${fixedChurchId}/prayer-archive`
    : '/api/v1/site/prayers'

  const result = useQuery({
    queryKey: queryKey(query, fixedChurchId),
    queryFn: async () => {
      const response = await axios.get(url, { params })
      return response.data.result as SitePrayerArchive
    },
    initialData: sameQuery(query, initialQuery) ? initialData : undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  return {
    data: result.data ?? initialData,
    loading: result.isFetching,
    error: result.error,
  }
}
