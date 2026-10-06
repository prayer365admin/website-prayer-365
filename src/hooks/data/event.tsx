'use client'

import { App } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import { useMainNotification } from '@/hooks/ui/notification'
import { EventCreateInput, EventListQuery, EventOutput, EventUpdateInput } from '@/models/event'

const eventsUrl = (churchId: string) =>
  '/api/v1/admin/churches/' + encodeURIComponent(churchId) + '/events'

type EventListControls = Partial<
  Pick<
    EventListQuery,
    'page' | 'limit' | 'search' | 'category' | 'has_link' | 'starts_from' | 'starts_to'
  >
> & {
  orderBy?: EventListQuery['order_by']
  orderDirection?: EventListQuery['order_direction']
}

export type EventListOptions = EventListControls & {
  churchId: string
  enableFetch?: boolean
}

export type EventUpdateVariables = { eventId: string; payload: EventUpdateInput }

type EventListFilters = EventListQuery

type EventApiError = {
  error_code?: string
  details?: string
  message?: string
  fields?: Record<string, string>
}

const isStaleVersion = (error: unknown) =>
  axios.isAxiosError(error) &&
  (error.response?.data as EventApiError | undefined)?.error_code === 'STALE_VERSION'

export const eventKeys = {
  lists: (userId: string | undefined, churchId: string) =>
    ['church', 'events', userId, churchId] as const,
  list: (userId: string | undefined, churchId: string, filters: EventListFilters) =>
    [...eventKeys.lists(userId, churchId), filters] as const,
}

const validationDescription = (data: EventApiError | undefined) => {
  const fieldDetails = Object.entries(data?.fields ?? {}).map(
    ([field, message]) => `${field}: ${message}`,
  )
  return (
    [data?.details ?? data?.message, ...fieldDetails].filter(Boolean).join(' ') ||
    'Review the event details and try again.'
  )
}

export const useEvents = ({
  churchId,
  page = 1,
  limit = 25,
  search,
  category,
  has_link,
  starts_from,
  starts_to,
  orderBy = 'starts_at',
  orderDirection = 'asc',
  enableFetch = true,
}: EventListOptions) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const { notification: antdNotification } = App.useApp()
  const normalizedSearch = search?.trim() || undefined
  const filters: EventListFilters = {
    page,
    limit,
    search: normalizedSearch,
    category,
    has_link,
    starts_from,
    starts_to,
    order_by: orderBy,
    order_direction: orderDirection,
  }
  const listFamilyKey = eventKeys.lists(userId, churchId)

  const query = useQuery({
    queryKey: eventKeys.list(userId, churchId, filters),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        order_by: orderBy,
        order_direction: orderDirection,
      })
      if (normalizedSearch) params.set('search', normalizedSearch)
      if (category) params.set('category', category)
      if (has_link) params.set('has_link', has_link)
      if (starts_from) params.set('starts_from', starts_from)
      if (starts_to) params.set('starts_to', starts_to)

      const response = await axios.get(`${eventsUrl(churchId)}?${params.toString()}`)
      return {
        result: response.data.result as EventOutput[],
        total: response.data.total as number,
      }
    },
    enabled: enableFetch && Boolean(churchId),
  })

  const mutationError = (error: unknown, action: 'create' | 'update') => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const data = error.response?.data as EventApiError | undefined
      if (data?.error_code === 'STALE_VERSION') {
        antdNotification.error({
          title: 'Version Conflict',
          description: `${data.details ?? 'This event changed while you were editing it.'} Refresh the event list and try again.`,
        })
        return
      }
      if (status === 422 || data?.error_code === 'VALIDATION_ERROR') {
        antdNotification.error({
          title: 'Invalid Event Data',
          description: validationDescription(data),
        })
        return
      }
    }
    notification({ type: 'error', entity: 'Event', action })
  }

  const create = useMutation({
    mutationFn: async (payload: EventCreateInput) => {
      const response = await axios.post(eventsUrl(churchId), payload)
      return response.data.result as EventOutput
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listFamilyKey })
      notification({ type: 'success', entity: 'Event', action: 'created' })
    },
    onError: (error) => mutationError(error, 'create'),
  })

  const update = useMutation({
    mutationFn: async ({ eventId, payload }: EventUpdateVariables) => {
      const response = await axios.patch(
        `${eventsUrl(churchId)}/${encodeURIComponent(eventId)}`,
        payload,
      )
      return response.data.result as EventOutput
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listFamilyKey })
      notification({ type: 'success', entity: 'Event', action: 'updated' })
    },
    onError: async (error) => {
      if (isStaleVersion(error)) {
        await queryClient.invalidateQueries({ queryKey: listFamilyKey })
      }
      mutationError(error, 'update')
    },
  })

  return {
    data: query.data?.result,
    total: query.data?.total,
    loading: query.isLoading || create.isPending || update.isPending,
    error: query.error,
    onCreate: create.mutateAsync,
    onUpdate: update.mutateAsync,
  }
}
