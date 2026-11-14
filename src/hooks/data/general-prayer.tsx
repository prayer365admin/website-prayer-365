'use client'

import { useMainNotification } from '@/hooks/ui/notification'
import type { MediaAccessOutput } from '@/models/media'
import type {
  GeneralPrayerCreate,
  GeneralPrayerOutput,
  GeneralPrayerUpdate,
} from '@/models/general-prayer'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App } from 'antd'
import axios from 'axios'
import { useSession } from 'next-auth/react'

const generalPrayersUrl = '/api/v1/admin/central/general-prayers'

export const generalPrayerKeys = {
  lists: (userId: string | undefined | null) => ['general-prayers', 'list', userId] as const,
  details: (userId: string | undefined | null) => ['general-prayers', 'detail', userId] as const,
  detail: (userId: string | undefined | null, generalPrayerId: string) =>
    [...generalPrayerKeys.details(userId), generalPrayerId] as const,
}

export const GENERAL_PRAYER_AUDIO_POLL_STATES = ['QUEUED', 'GENERATING'] as const

/**
 * Poll the detail every 2s while a generation is in flight; stop on READY/FAILED.
 *
 * `QUEUED` only counts as in flight when this screen enqueued it (`pollQueued`):
 * seeded or imported rows also start at QUEUED with no job behind them, and
 * polling those forever would hammer the API for content nobody is generating.
 */
export const generalPrayerPollInterval = (
  query: { state: { data?: { audioStatus?: string } } },
  { pollQueued = false }: { pollQueued?: boolean } = {},
): number | false => {
  const status = query.state.data?.audioStatus ?? ''
  if (status === 'GENERATING') return 2000
  if (status === 'QUEUED' && pollQueued) return 2000
  return false
}

const useGeneralPrayerNotifications = () => {
  const notification = useMainNotification()
  const { notification: antdNotification } = App.useApp()

  const mutationError = (error: unknown, action: string) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const data = error.response?.data as
        { error_code?: string; details?: string; message?: string } | undefined
      if (data?.error_code === 'STALE_VERSION') {
        antdNotification.error({
          title: 'Version Conflict',
          description: data.details ?? 'This prayer changed. Refresh and try again.',
        })
        return
      }
      if (data?.error_code === 'AUDIO_GENERATING') {
        antdNotification.error({
          title: 'Audio Already Generating',
          description: data.details ?? 'Wait for the current generation to finish.',
        })
        return
      }
      if (data?.error_code === 'SEQUENCE_TAKEN') {
        antdNotification.error({
          title: 'Cycle Position Taken',
          description: data.details ?? 'Another general prayer already holds that cycle position.',
        })
        return
      }
      if (status === 409 || status === 422) {
        antdNotification.error({
          title: status === 409 ? 'Conflict' : 'Invalid Prayer Data',
          description: data?.details ?? data?.message ?? 'Review the prayer data and try again.',
        })
        return
      }
    }
    notification({ type: 'error', entity: 'General prayer', action })
  }

  return { notification, mutationError }
}

export interface GeneralPrayerListOptions {
  page?: number
  limit?: number
  search?: string
  isActive?: boolean
  enableFetch?: boolean
}

export const useGeneralPrayers = (options: GeneralPrayerListOptions = {}) => {
  const { page = 1, limit = 10, search, isActive, enableFetch = true } = options
  const { data: session } = useSession()
  const userId = session?.user.user_id ?? null

  const { data, isLoading, error } = useQuery({
    queryKey: [
      ...generalPrayerKeys.lists(userId),
      { page, limit, search: search ?? '', isActive: isActive ?? null },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (search?.trim()) params.set('search', search.trim())
      if (isActive !== undefined) params.set('isActive', String(isActive))
      const response = await axios.get(generalPrayersUrl, { params })
      return {
        result: response.data.result as GeneralPrayerOutput[],
        total: response.data.total as number,
      }
    },
    enabled: enableFetch,
  })

  return { data: data?.result ?? [], total: data?.total ?? 0, loading: isLoading, error }
}

/**
 * Count of ACTIVE prayers — exactly what the daily send job cycles over
 * (GP-UI-06). The list endpoint's `isActive=true` filter gives it as `total`,
 * so no extra route is needed.
 */
export const useGeneralPrayerActiveCount = (enableFetch = true) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id ?? null

  const { data } = useQuery({
    queryKey: [...generalPrayerKeys.lists(userId), 'active-count'],
    queryFn: async () => {
      const response = await axios.get(generalPrayersUrl, {
        params: { page: 1, limit: 1, isActive: 'true' },
      })
      return response.data.total as number
    },
    enabled: enableFetch,
  })

  return data ?? 0
}

export const useGeneralPrayer = (
  generalPrayerId: string,
  { pollQueued = false }: { pollQueued?: boolean } = {},
) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id ?? null

  const { data, isLoading, error } = useQuery({
    queryKey: generalPrayerKeys.detail(userId, generalPrayerId),
    queryFn: async () => {
      const response = await axios.get(`${generalPrayersUrl}/${generalPrayerId}`)
      return response.data.result as GeneralPrayerOutput
    },
    enabled: !!generalPrayerId,
    refetchInterval: (query) => generalPrayerPollInterval(query, { pollQueued }),
  })

  return { data, loading: isLoading, error }
}

/** Admin player URL for a church-less GENERATED_AUDIO asset (auth-only route). */
export const useGeneralPrayerAudioAccess = (assetId: string | null | undefined) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id ?? null

  const { data, isLoading } = useQuery({
    queryKey: ['general-prayer-audio-access', userId, assetId],
    queryFn: async () => {
      const response = await axios.get(`/api/v1/uploads/${assetId}/access`)
      return response.data.result as MediaAccessOutput
    },
    enabled: !!assetId,
    retry: false,
    staleTime: 50 * 60 * 1000,
  })

  return { data, loading: isLoading }
}

export const useCreateGeneralPrayer = () => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const { notification, mutationError } = useGeneralPrayerNotifications()

  const { mutateAsync: onCreate, isPending: loading } = useMutation({
    mutationFn: async (payload: GeneralPrayerCreate) => {
      const response = await axios.post(generalPrayersUrl, payload)
      return response.data.result as GeneralPrayerOutput
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: generalPrayerKeys.lists(userId) })
      notification({ type: 'success', entity: 'General prayer', action: 'created' })
    },
    onError: (error) => mutationError(error, 'create'),
  })

  return { onCreate, loading }
}

export const useUpdateGeneralPrayer = (generalPrayerId: string) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const { notification, mutationError } = useGeneralPrayerNotifications()

  const { mutateAsync: onUpdate, isPending: loading } = useMutation({
    mutationFn: async (payload: GeneralPrayerUpdate) => {
      const response = await axios.patch(`${generalPrayersUrl}/${generalPrayerId}`, payload)
      return response.data.result as GeneralPrayerOutput
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: generalPrayerKeys.lists(userId) }),
        queryClient.invalidateQueries({
          queryKey: generalPrayerKeys.detail(userId, generalPrayerId),
        }),
      ])
      notification({ type: 'success', entity: 'General prayer', action: 'updated' })
    },
    onError: async (error) => {
      mutationError(error, 'update')
      // A conflict means the server moved on: pull the fresh version so the
      // next save uses it instead of silently overwriting.
      if (axios.isAxiosError(error) && (error.response?.status ?? 0) >= 400) {
        await queryClient.invalidateQueries({
          queryKey: generalPrayerKeys.detail(userId, generalPrayerId),
        })
      }
    },
  })

  return { onUpdate, loading }
}

export const useEnqueueGeneralPrayerAudio = (generalPrayerId: string) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const { notification, mutationError } = useGeneralPrayerNotifications()

  const { mutateAsync: onEnqueueAudio, isPending: loading } = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`${generalPrayersUrl}/${generalPrayerId}/audio`)
      return response.data.result as GeneralPrayerOutput
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: generalPrayerKeys.lists(userId) }),
        queryClient.invalidateQueries({
          queryKey: generalPrayerKeys.detail(userId, generalPrayerId),
        }),
      ])
      notification({ type: 'success', entity: 'General prayer audio', action: 'queued' })
    },
    onError: (error) => mutationError(error, 'audio'),
  })

  return { onEnqueueAudio, loading }
}
