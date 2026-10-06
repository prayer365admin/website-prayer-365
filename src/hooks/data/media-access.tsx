import { MediaAccessOutput } from '@/models/media'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'

export const useMediaAccess = (churchId: string, assetId: string | null | undefined) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id ?? null

  const { data, isLoading } = useQuery({
    queryKey: ['media-access', userId, churchId, assetId],
    queryFn: async () => {
      const response = await axios.get(`/api/v1/uploads/${assetId}/access?churchId=${churchId}`)
      return response.data.result as MediaAccessOutput
    },
    enabled: !!churchId && !!assetId,
    staleTime: 50 * 60 * 1000,
  })

  return { data, loading: isLoading }
}
