import { MobileMe, MobileMyChurch, SiteMePatch } from '@/models/mobile'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'

// Website profile (WB-16). Every key carries the session user id so one
// customer never reads another's cached profile after switching accounts.
const baseUrl = '/api/v1/site/me'

const meKey = (userId?: string) => ['site', 'me', userId]

const useUserId = () => useSession().data?.user?.user_id

export const useMe = () => {
  const userId = useUserId()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: meKey(userId),
    queryFn: async () => (await axios.get(baseUrl)).data.result as MobileMe,
    enabled: !!userId,
  })

  const { mutateAsync: onPatch, isPending: patching } = useMutation({
    mutationFn: async (payload: SiteMePatch) =>
      (await axios.patch(baseUrl, payload)).data.result as MobileMe,
    // Prefix invalidation: profile + my churches (main church may have moved).
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meKey(userId) }),
  })

  return { data, loading: isLoading, onPatch, patching }
}

export const useMyChurches = () => {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const key = [...meKey(userId), 'churches']

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => (await axios.get(`${baseUrl}/churches`)).data.result as MobileMyChurch[],
    enabled: !!userId,
  })

  const { mutateAsync: onFollow, isPending: following } = useMutation({
    mutationFn: async ({ churchId, isFollowed }: { churchId: string; isFollowed: boolean }) => {
      const url = `${baseUrl}/follows/${encodeURIComponent(churchId)}`
      return isFollowed ? axios.put(url) : axios.delete(url)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  return { data: data ?? [], loading: isLoading, onFollow, following }
}
