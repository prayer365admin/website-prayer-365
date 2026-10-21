import { MobileMe, MobileMyChurch, SiteMePatch } from '@/models/mobile'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'

// Website profile (WB-16). Every key carries the session user id so one
// customer never reads another's cached profile after switching accounts.
const baseUrl = '/api/v1/site/me'

const meKey = (userId?: string) => ['site', 'me', userId]

type MeQueryOptions = {
  userId?: string
  initialData?: MobileMe
}

type ChurchesQueryOptions = {
  userId?: string
  initialData?: MobileMyChurch[]
}

export const useMe = (options: MeQueryOptions = {}) => {
  const session = useSession()
  const userId = options.userId ?? session.data?.user?.user_id
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: meKey(userId),
    queryFn: async () => (await axios.get(baseUrl)).data.result as MobileMe,
    enabled: !!userId,
    initialData: options.initialData,
    staleTime: options.initialData ? 1000 * 60 * 5 : undefined,
  })

  const { mutateAsync: onPatch, isPending: patching } = useMutation({
    mutationFn: async (payload: SiteMePatch) =>
      (await axios.patch(baseUrl, payload)).data.result as MobileMe,
    // Prefix invalidation: profile + my churches (main church may have moved).
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meKey(userId) }),
  })

  const waitingForSession = !options.userId && session.status === 'loading'
  return { data, loading: waitingForSession || isLoading, onPatch, patching }
}

export const useMyChurches = (options: ChurchesQueryOptions = {}) => {
  const session = useSession()
  const userId = options.userId ?? session.data?.user?.user_id
  const queryClient = useQueryClient()
  const key = [...meKey(userId), 'churches']

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await axios.get(`${baseUrl}/churches`)
      const raw = res.data?.result
      return (Array.isArray(raw) ? raw : []) as MobileMyChurch[]
    },
    enabled: !!userId,
    initialData: options.initialData,
    staleTime: options.initialData ? 1000 * 60 * 5 : undefined,
  })

  const { mutateAsync: onFollow, isPending: following } = useMutation({
    mutationFn: async ({ churchId, isFollowed }: { churchId: string; isFollowed: boolean }) => {
      const url = `${baseUrl}/follows/${encodeURIComponent(churchId)}`
      return isFollowed ? axios.put(url) : axios.delete(url)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key })
      queryClient.invalidateQueries({ queryKey: ['site', 'home'] })
    },
  })

  const waitingForSession = !options.userId && session.status === 'loading'
  return { data: data ?? [], loading: waitingForSession || isLoading, onFollow, following }
}
