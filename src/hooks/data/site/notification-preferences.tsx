import { MobileNotificationPreferences } from '@/models/mobile'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'

// Website notification preferences (WB-17). Keyed by session user id so one
// customer never reads another's cached switches after an account switch. The
// site route is the twin of PUT /api/v1/mobile/me/notification-preferences:
// both write the same six rows, so this page and the app never disagree.
const baseUrl = '/api/v1/site/me/notification-preferences'

const prefsKey = (userId?: string) => ['site', 'notification-preferences', userId]

export const useNotificationPreferences = (initialData?: MobileNotificationPreferences) => {
  const session = useSession()
  const userId = session.data?.user?.user_id
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: prefsKey(userId),
    queryFn: async () => (await axios.get(baseUrl)).data.result as MobileNotificationPreferences,
    enabled: !!userId,
    initialData,
    staleTime: initialData ? 1000 * 60 * 5 : undefined,
  })

  const { mutateAsync: onSave, isPending: saving } = useMutation({
    mutationFn: async (payload: MobileNotificationPreferences) =>
      (await axios.put(baseUrl, payload)).data.result as MobileNotificationPreferences,
    onSuccess: (saved) => {
      queryClient.setQueryData(prefsKey(userId), saved)
    },
  })

  const waitingForSession = session.status === 'loading'
  return { data, loading: waitingForSession || isLoading, onSave, saving }
}
