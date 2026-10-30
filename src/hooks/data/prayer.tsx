import { useMainNotification } from '@/hooks/ui/notification'
import {
  CentralPrayerOutput,
  PrayerActionInput,
  PrayerAudioEnqueueInput,
  PrayerAudioOutput,
  PrayerInput,
  PrayerOutput,
  PrayerVersionOutput,
  PublishInput,
  ScheduleInput,
} from '@/models/prayer'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App } from 'antd'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import { useCallback } from 'react'

export interface PrayerListOptions {
  churchId: string
  page?: number
  limit?: number
  orderBy?: 'created_at' | 'published_at'
  orderDirection?: 'asc' | 'desc'
  status?: 'current' | 'archive'
  search?: string
  enableFetch?: boolean
}

export const AUDIO_POLL_ACTIVE_STATES = ['QUEUED', 'GENERATING'] as const

export const audioPollInterval = (query: {
  state: { data?: { status?: string } }
}): number | false =>
  AUDIO_POLL_ACTIVE_STATES.includes((query.state.data?.status ?? '') as never) ? 2000 : false

export const usePrayers = (options: PrayerListOptions) => {
  const {
    churchId,
    page = 1,
    limit = 25,
    orderBy = 'created_at',
    orderDirection = 'desc',
    status,
    search = '',
    enableFetch = true,
  } = options
  const { data: session } = useSession()
  const userId = session?.user.user_id ?? null

  const queryParams = new URLSearchParams()
  queryParams.set('page', page.toString())
  queryParams.set('limit', limit.toString())
  queryParams.set('order_by', orderBy)
  queryParams.set('order_direction', orderDirection)
  if (status) {
    queryParams.set('status', status)
  }
  if (search) {
    queryParams.set('search', search)
  }

  const listUrl = `/api/v1/admin/churches/${churchId}/prayers`

  const { data, isLoading } = useQuery({
    queryKey: ['prayers', userId, churchId, page, limit, orderBy, orderDirection, status, search],
    queryFn: async () => {
      const response = await axios.get(`${listUrl}?${queryParams.toString()}`)
      return {
        result: response.data.result as PrayerOutput[],
        total: response.data.total as number,
      }
    },
    enabled: !!enableFetch && !!churchId,
  })

  return { data: data?.result ?? [], total: data?.total ?? 0, loading: isLoading }
}

/**
 * Central (cross-church) prayer list (plan 023). Same shape as the per-church list
 * plus the church name, so the table shows which parish each prayer belongs to.
 */
export interface CentralPrayerListOptions {
  page?: number
  limit?: number
  orderBy?: 'created_at' | 'published_at'
  orderDirection?: 'asc' | 'desc'
  status?: 'current' | 'archive'
  search?: string
  churchId?: string
}

export const useCentralPrayers = (options: CentralPrayerListOptions = {}) => {
  const {
    page = 1,
    limit = 25,
    orderBy = 'created_at',
    orderDirection = 'desc',
    status,
    search,
    churchId,
  } = options
  const { data: session } = useSession()
  const userId = session?.user.user_id ?? null

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    order_by: orderBy,
    order_direction: orderDirection,
  })
  if (status) params.set('status', status)
  if (search) params.set('search', search)
  if (churchId) params.set('churchId', churchId)

  const { data, isLoading } = useQuery({
    queryKey: [
      'prayers',
      'central',
      userId,
      page,
      limit,
      orderBy,
      orderDirection,
      status,
      search,
      churchId,
    ],
    queryFn: async () => {
      const response = await axios.get(`/api/v1/admin/central/prayers?${params.toString()}`)
      return {
        result: response.data.result as CentralPrayerOutput[],
        total: response.data.total as number,
      }
    },
  })

  return { data: data?.result ?? [], total: data?.total ?? 0, loading: isLoading }
}

export const useCentralPrayer = (prayerId: string) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id ?? null

  const { data, isLoading, error } = useQuery({
    queryKey: ['prayer', 'central', userId, prayerId],
    queryFn: async () => {
      const response = await axios.get(`/api/v1/admin/central/prayers/${prayerId}`)
      return response.data.result as CentralPrayerOutput
    },
    enabled: !!prayerId,
  })

  return { data, loading: isLoading, error }
}

export const usePrayer = (churchId: string, prayerId: string) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id ?? null

  const detailUrl = `/api/v1/admin/churches/${churchId}/prayers/${prayerId}`

  const { data, isLoading } = useQuery({
    queryKey: ['prayer', userId, churchId, prayerId],
    queryFn: async () => {
      const response = await axios.get(detailUrl)
      return response.data.result as PrayerOutput
    },
    enabled: !!churchId && !!prayerId,
  })

  return { data, loading: isLoading }
}

export const useCreatePrayer = (churchId: string) => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const { notification: antdNotification } = App.useApp()
  const listUrl = `/api/v1/admin/churches/${churchId}/prayers`

  const { mutateAsync: onCreate, isPending: loading } = useMutation({
    mutationFn: useCallback(
      async (payload: PrayerInput) => {
        const response = await axios.post(listUrl, payload)
        return response.data.result as PrayerOutput
      },
      [listUrl],
    ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['prayers'] })
      notification({ type: 'success', entity: 'prayer', action: 'created' })
      return result
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error?.response?.data?.error_code === 'STALE_VERSION') {
        antdNotification.error({
          title: 'Version Conflict',
          description: 'This prayer has changed. Please refresh your browser and try again.',
        } as Record<string, unknown>)
      } else {
        notification({ type: 'error', entity: 'prayer', action: 'created' })
      }
    },
  })

  return { onCreate, loading }
}

export const usePatchPrayer = (churchId: string, prayerId: string) => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const { notification: antdNotification } = App.useApp()
  const detailUrl = `/api/v1/admin/churches/${churchId}/prayers/${prayerId}`

  const { mutateAsync: onPatch, isPending: loading } = useMutation({
    mutationFn: useCallback(
      async (payload: PrayerInput) => {
        const response = await axios.patch(detailUrl, payload)
        return response.data.result as PrayerOutput
      },
      [detailUrl],
    ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['prayers'] })
      queryClient.invalidateQueries({ queryKey: ['prayer'] })
      notification({ type: 'success', entity: 'prayer', action: 'updated' })
      return result
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error?.response?.data?.error_code === 'STALE_VERSION') {
        antdNotification.error({
          title: 'Version Conflict',
          description: 'This prayer has changed. Please refresh your browser and try again.',
        } as Record<string, unknown>)
      } else {
        notification({ type: 'error', entity: 'prayer', action: 'updated' })
      }
    },
  })

  return { onPatch, loading }
}

export const useApproveText = (churchId: string, prayerId: string) => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const { notification: antdNotification } = App.useApp()
  const approveTextUrl = `/api/v1/admin/churches/${churchId}/prayers/${prayerId}/approve-text`

  const { mutateAsync: onApproveText, isPending: loading } = useMutation({
    mutationFn: useCallback(
      async (payload: PrayerActionInput) => {
        const response = await axios.post(approveTextUrl, payload)
        return response.data.result as PrayerVersionOutput
      },
      [approveTextUrl],
    ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['prayers'] })
      queryClient.invalidateQueries({ queryKey: ['prayer'] })
      notification({ type: 'success', entity: 'prayer', action: 'approved' })
      return result
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error?.response?.data?.error_code === 'STALE_VERSION') {
        antdNotification.error({
          title: 'Version Conflict',
          description: 'This prayer has changed. Please refresh your browser and try again.',
        } as Record<string, unknown>)
      } else {
        notification({ type: 'error', entity: 'prayer', action: 'approved' })
      }
    },
  })

  return { onApproveText, loading }
}

export const useEnqueueAudio = (churchId: string, prayerId: string) => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const { notification: antdNotification } = App.useApp()
  const audioUrl = `/api/v1/admin/churches/${churchId}/prayers/${prayerId}/audio`

  const { mutateAsync: onEnqueueAudio, isPending: loading } = useMutation({
    mutationFn: useCallback(
      async (payload: PrayerAudioEnqueueInput) => {
        const response = await axios.post(audioUrl, payload, {
          headers: { 'idempotency-key': crypto.randomUUID() },
        })
        return response.data.result as PrayerAudioOutput
      },
      [audioUrl],
    ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['prayers'] })
      queryClient.invalidateQueries({ queryKey: ['prayer'] })
      queryClient.invalidateQueries({ queryKey: ['prayer-audio'] })
      notification({ type: 'success', entity: 'prayer audio', action: 'queued' })
      return result
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error?.response?.data?.error_code === 'STALE_VERSION') {
        antdNotification.error({
          title: 'Version Conflict',
          description: 'This prayer has changed. Please refresh your browser and try again.',
        } as Record<string, unknown>)
      } else {
        notification({ type: 'error', entity: 'prayer audio', action: 'queued' })
      }
    },
  })

  return { onEnqueueAudio, loading }
}

export const usePrayerAudio = (churchId: string, prayerId: string, audioId?: string | null) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id ?? null

  const audioDetailUrl = `/api/v1/admin/churches/${churchId}/prayers/${prayerId}/audio/${audioId}`

  const { data, isLoading } = useQuery({
    queryKey: ['prayer-audio', userId, churchId, prayerId, audioId],
    queryFn: async () => {
      const response = await axios.get(audioDetailUrl)
      return response.data.result as PrayerAudioOutput
    },
    enabled: !!churchId && !!prayerId && !!audioId,
    refetchInterval: audioPollInterval,
  })

  return { data, loading: isLoading }
}

export const useApproveAudio = (churchId: string, prayerId: string, audioId: string) => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const { notification: antdNotification } = App.useApp()
  const approveAudioUrl = `/api/v1/admin/churches/${churchId}/prayers/${prayerId}/audio/${audioId}/approve`

  const { mutateAsync: onApproveAudio, isPending: loading } = useMutation({
    mutationFn: useCallback(
      async (payload: PrayerActionInput) => {
        const response = await axios.post(approveAudioUrl, payload)
        return response.data.result as PrayerAudioOutput
      },
      [approveAudioUrl],
    ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['prayers'] })
      queryClient.invalidateQueries({ queryKey: ['prayer'] })
      queryClient.invalidateQueries({ queryKey: ['prayer-audio'] })
      notification({ type: 'success', entity: 'prayer audio', action: 'approved' })
      return result
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error?.response?.data?.error_code === 'STALE_VERSION') {
        antdNotification.error({
          title: 'Version Conflict',
          description: 'This prayer has changed. Please refresh your browser and try again.',
        } as Record<string, unknown>)
      } else {
        notification({ type: 'error', entity: 'prayer audio', action: 'approved' })
      }
    },
  })

  return { onApproveAudio, loading }
}

export const useSchedulePrayer = (churchId: string, prayerId: string) => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const { notification: antdNotification } = App.useApp()
  const scheduleUrl = `/api/v1/admin/churches/${churchId}/prayers/${prayerId}/schedule`

  const { mutateAsync: onSchedule, isPending: loading } = useMutation({
    mutationFn: useCallback(
      async (payload: ScheduleInput) => {
        const response = await axios.put(scheduleUrl, payload)
        return response.data.result as PrayerOutput
      },
      [scheduleUrl],
    ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['prayers'] })
      queryClient.invalidateQueries({ queryKey: ['prayer'] })
      notification({ type: 'success', entity: 'prayer', action: 'scheduled' })
      return result
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error?.response?.data?.error_code === 'STALE_VERSION') {
        antdNotification.error({
          title: 'Version Conflict',
          description: 'This prayer has changed. Please refresh your browser and try again.',
        } as Record<string, unknown>)
      } else {
        notification({ type: 'error', entity: 'prayer', action: 'scheduled' })
      }
    },
  })

  return { onSchedule, loading }
}

export const usePublishPrayer = (churchId: string, prayerId: string) => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const { notification: antdNotification } = App.useApp()
  const publishUrl = `/api/v1/admin/churches/${churchId}/prayers/${prayerId}/publish`

  const { mutateAsync: onPublish, isPending: loading } = useMutation({
    mutationFn: useCallback(
      async (payload: PublishInput) => {
        const response = await axios.post(publishUrl, payload, {
          headers: { 'idempotency-key': crypto.randomUUID() },
        })
        return response.data.result as PrayerOutput
      },
      [publishUrl],
    ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['prayers'] })
      queryClient.invalidateQueries({ queryKey: ['prayer'] })
      notification({ type: 'success', entity: 'prayer', action: 'published' })
      return result
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error?.response?.data?.error_code === 'STALE_VERSION') {
        antdNotification.error({
          title: 'Version Conflict',
          description: 'This prayer has changed. Please refresh your browser and try again.',
        } as Record<string, unknown>)
      } else {
        notification({ type: 'error', entity: 'prayer', action: 'published' })
      }
    },
  })

  return { onPublish, loading }
}
