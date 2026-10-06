import { ChurchPastorSummary } from '@/models/pastor'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'

export const useChurchPastors = (churchId: string) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id ?? null

  const { data, isLoading } = useQuery({
    queryKey: ['church-pastors', userId, churchId],
    queryFn: async () => {
      const response = await axios.get(`/api/v1/admin/churches/${churchId}/pastors`)
      return response.data.result as ChurchPastorSummary[]
    },
    enabled: !!churchId,
  })

  return { data: data ?? [], loading: isLoading }
}
