'use client'

import { useOrgNotifications } from '@/hooks/data/central'
import type { NotificationRecurrence, NotificationRulesUpdate } from '@/models/notification'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'

/*
 * Central notification rules (F11): read + update only. There is no create or
 * delete — the allowed rule types always exist, so the screen only edits them.
 */

const notificationRulesUrl = '/api/v1/admin/central/notification-rules'

/** Shape returned by GET/PUT (route `RuleDtoSchema`); the list is already type-filtered server-side. */
export type NotificationRuleData = {
  id: string
  type: string
  enabled: boolean
  push_enabled: boolean
  email_enabled: boolean
  offset_minutes: number | null
  recurrence: NotificationRecurrence | null
  version: number
}

export const notificationKeys = {
  list: (userId: string | undefined) => ['central', 'notification-rules', userId] as const,
}

export const useNotificationRules = () => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const { notification, mutationError } = useOrgNotifications()

  const query = useQuery({
    queryKey: notificationKeys.list(userId),
    queryFn: async () => {
      const response = await axios.get(notificationRulesUrl)
      return response.data.result as NotificationRuleData[]
    },
  })

  const save = useMutation({
    mutationFn: async (payload: NotificationRulesUpdate) =>
      axios.put(notificationRulesUrl, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) })
      notification({ type: 'success', entity: 'Notification rule', action: 'updated' })
    },
    onError: (error) => mutationError(error, 'Notification rule', 'update'),
  })

  return {
    data: query.data,
    loading: query.isLoading,
    saving: save.isPending,
    error: query.error,
    onSave: save.mutateAsync,
  }
}
