import type { MobilePublicEvent } from '@/models/mobile'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const eventKey = (churchId: string | null | undefined) => [
  'site',
  'church',
  churchId,
  'upcoming-events',
]

export const useUpcomingChurchEvents = (churchId: string | null | undefined) => {
  const { data, isLoading } = useQuery({
    queryKey: eventKey(churchId),
    queryFn: async () => {
      const url = `/api/v1/mobile/churches/${encodeURIComponent(churchId!)}/events`
      const response = await axios.get(url, { params: { page: 1, limit: 5 } })
      return response.data.result as MobilePublicEvent[]
    },
    enabled: !!churchId,
    staleTime: 5 * 60 * 1000,
  })

  return { data: data ?? [], loading: isLoading }
}
