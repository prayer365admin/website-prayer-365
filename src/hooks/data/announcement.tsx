'use client'

import { App } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import { useMainNotification } from '@/hooks/ui/notification'
import {
  AnnouncementInput,
  AnnouncementListItem,
  AnnouncementListQuery,
  AnnouncementOutput,
} from '@/models/announcement'

const announcementsUrl = (churchId: string) =>
  '/api/v1/admin/churches/' + encodeURIComponent(churchId) + '/announcements'

type AnnouncementListFilters = AnnouncementListQuery

export type AnnouncementListOptions = {
  churchId: string
  page?: number
  limit?: number
  search?: string
  status?: AnnouncementListQuery['status']
  publishedFrom?: string
  publishedTo?: string
  orderBy?: AnnouncementListQuery['order_by']
  orderDirection?: AnnouncementListQuery['order_direction']
  enableFetch?: boolean
}

export type AnnouncementUpdateVariables = {
  announcementId: string
  payload: AnnouncementInput & { version: number }
}

export type AnnouncementCreatePayload = Omit<AnnouncementInput, 'version'>

export type AnnouncementPublishVariables = {
  announcementId: string
  version: number
}

export type AnnouncementUnpublishVariables = AnnouncementPublishVariables

export type AnnouncementDeleteVariables = AnnouncementPublishVariables

type WithChurch<T> = T & { churchId: string }

type AnnouncementApiError = {
  error_code?: string
  details?: string
  message?: string
  fields?: Record<string, string>
}

export const announcementKeys = {
  lists: (userId: string | undefined, churchId: string) =>
    ['church', 'announcements', userId, churchId] as const,
  central: (userId: string | undefined) => ['central', 'announcements', userId] as const,
  centralDetail: (userId: string | undefined, announcementId: string) =>
    [...announcementKeys.central(userId), 'detail', announcementId] as const,
  list: (userId: string | undefined, churchId: string, filters: AnnouncementListFilters) =>
    [...announcementKeys.lists(userId, churchId), filters] as const,
}

const validationDescription = (data: AnnouncementApiError | undefined) => {
  const fieldDetails = Object.entries(data?.fields ?? {}).map(
    ([field, message]) => `${field}: ${message}`,
  )
  return (
    [data?.details ?? data?.message, ...fieldDetails].filter(Boolean).join(' ') ||
    'Review the announcement and try again.'
  )
}

export const useAnnouncements = ({
  churchId,
  page = 1,
  limit = 25,
  search,
  status,
  publishedFrom,
  publishedTo,
  orderBy = 'created_at',
  orderDirection = 'desc',
  enableFetch = true,
}: AnnouncementListOptions) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const actions = useAnnouncementActions()
  const normalizedSearch = search?.trim() || undefined
  const filters: AnnouncementListFilters = {
    page,
    limit,
    search: normalizedSearch,
    status,
    published_from: publishedFrom,
    published_to: publishedTo,
    order_by: orderBy,
    order_direction: orderDirection,
  }
  const query = useQuery({
    queryKey: announcementKeys.list(userId, churchId, filters),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        order_by: orderBy,
        order_direction: orderDirection,
      })
      if (normalizedSearch) params.set('search', normalizedSearch)
      if (status) params.set('status', status)
      if (publishedFrom) params.set('published_from', publishedFrom)
      if (publishedTo) params.set('published_to', publishedTo)

      const response = await axios.get(`${announcementsUrl(churchId)}?${params.toString()}`)
      return {
        result: response.data.result as AnnouncementOutput[],
        total: response.data.total as number,
      }
    },
    enabled: enableFetch && Boolean(churchId),
  })

  return {
    data: query.data?.result,
    total: query.data?.total,
    loading: query.isLoading,
    saving: actions.saving,
    publishingId: actions.publishingId,
    unpublishingId: actions.unpublishingId,
    error: query.error,
    onCreate: (payload: AnnouncementCreatePayload) => actions.onCreate({ ...payload, churchId }),
    onUpdate: (variables: AnnouncementUpdateVariables) =>
      actions.onUpdate({ ...variables, churchId }),
    onPublish: (variables: AnnouncementPublishVariables) =>
      actions.onPublish({ ...variables, churchId }),
    onUnpublish: (variables: AnnouncementUnpublishVariables) =>
      actions.onUnpublish({ ...variables, churchId }),
    onDelete: (variables: AnnouncementDeleteVariables) =>
      actions.onDelete({ ...variables, churchId }),
  }
}

/**
 * Announcement mutations with the church passed per call, so cross-church
 * (central) screens can act on rows from any church. Refreshes that church's
 * list and every central list/detail.
 */
export const useAnnouncementActions = () => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const { notification: antdNotification } = App.useApp()

  // Not awaited: mutateAsync resolves on the server response, and active lists
  // refetch in the background instead of serialising a round trip per step
  // (e.g. save then publish, then navigate away).
  const refresh = (churchId: string) => {
    void queryClient.invalidateQueries({ queryKey: announcementKeys.lists(userId, churchId) })
    void queryClient.invalidateQueries({ queryKey: announcementKeys.central(userId) })
  }
  const itemUrl = (churchId: string, announcementId: string) =>
    `${announcementsUrl(churchId)}/${encodeURIComponent(announcementId)}`

  const mutationError = (
    error: unknown,
    action: 'create' | 'update' | 'publish' | 'unpublish' | 'delete',
  ) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const data = error.response?.data as AnnouncementApiError | undefined
      if (data?.error_code === 'STALE_VERSION') {
        antdNotification.error({
          title: 'Version Conflict',
          description: `${data.details ?? 'This announcement changed while you were working.'} Refresh the announcement list and try again.`,
        })
        return
      }
      if (status === 422 || data?.error_code === 'VALIDATION_ERROR') {
        antdNotification.error({
          title: 'Invalid Announcement',
          description: validationDescription(data),
        })
        return
      }
    }
    notification({ type: 'error', entity: 'Announcement', action })
  }

  const create = useMutation({
    mutationFn: async ({ churchId, ...payload }: WithChurch<AnnouncementCreatePayload>) => {
      const response = await axios.post(announcementsUrl(churchId), payload)
      return response.data.result as AnnouncementOutput
    },
    onSuccess: (_, { churchId }) => {
      refresh(churchId)
      notification({ type: 'success', entity: 'Announcement', action: 'created' })
    },
    onError: (error) => mutationError(error, 'create'),
  })

  const update = useMutation({
    mutationFn: async ({
      churchId,
      announcementId,
      payload,
    }: WithChurch<AnnouncementUpdateVariables>) => {
      const response = await axios.patch(itemUrl(churchId, announcementId), payload)
      return response.data.result as AnnouncementOutput
    },
    onSuccess: (_, { churchId }) => {
      refresh(churchId)
      notification({ type: 'success', entity: 'Announcement', action: 'updated' })
    },
    onError: (error, { churchId }) => {
      refresh(churchId)
      mutationError(error, 'update')
    },
  })

  const publish = useMutation({
    mutationFn: async ({
      churchId,
      announcementId,
      version,
    }: WithChurch<AnnouncementPublishVariables>) => {
      const response = await axios.post(`${itemUrl(churchId, announcementId)}/publish`, {
        version,
      })
      return response.data.result as AnnouncementOutput
    },
    onSuccess: (_, { churchId }) => {
      refresh(churchId)
      notification({ type: 'success', entity: 'Announcement', action: 'published' })
    },
    onError: (error, { churchId }) => {
      refresh(churchId)
      mutationError(error, 'publish')
    },
  })

  const unpublish = useMutation({
    mutationFn: async ({
      churchId,
      announcementId,
      version,
    }: WithChurch<AnnouncementUnpublishVariables>) => {
      const response = await axios.post(`${itemUrl(churchId, announcementId)}/unpublish`, {
        version,
      })
      return response.data.result as AnnouncementOutput
    },
    onSuccess: (_, { churchId }) => {
      refresh(churchId)
      notification({ type: 'success', entity: 'Announcement', action: 'unpublished' })
    },
    onError: (error, { churchId }) => {
      refresh(churchId)
      mutationError(error, 'unpublish')
    },
  })

  const remove = useMutation({
    mutationFn: async ({
      churchId,
      announcementId,
      version,
    }: WithChurch<AnnouncementDeleteVariables>) => {
      await axios.delete(itemUrl(churchId, announcementId), { data: { version } })
    },
    onSuccess: (_, { churchId }) => {
      refresh(churchId)
      notification({ type: 'success', entity: 'Announcement', action: 'deleted' })
    },
    onError: (error, { churchId }) => {
      refresh(churchId)
      mutationError(error, 'delete')
    },
  })

  return {
    saving: create.isPending || update.isPending,
    publishingId: publish.isPending ? publish.variables?.announcementId : undefined,
    unpublishingId: unpublish.isPending ? unpublish.variables?.announcementId : undefined,
    onCreate: create.mutateAsync,
    onUpdate: update.mutateAsync,
    onPublish: publish.mutateAsync,
    onUnpublish: unpublish.mutateAsync,
    onDelete: remove.mutateAsync,
  }
}

export type CentralAnnouncementListOptions = Omit<AnnouncementListOptions, 'churchId'>

/** List across every church in the caller's central scope; act on rows via useAnnouncementActions. */
export const useCentralAnnouncements = ({
  page = 1,
  limit = 25,
  search,
  status,
  publishedFrom,
  publishedTo,
  orderBy = 'created_at',
  orderDirection = 'desc',
  enableFetch = true,
}: CentralAnnouncementListOptions = {}) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const normalizedSearch = search?.trim() || undefined

  const query = useQuery({
    queryKey: [
      ...announcementKeys.central(userId),
      {
        page,
        limit,
        search: normalizedSearch,
        status,
        publishedFrom,
        publishedTo,
        orderBy,
        orderDirection,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        order_by: orderBy,
        order_direction: orderDirection,
      })
      if (normalizedSearch) params.set('search', normalizedSearch)
      if (status) params.set('status', status)
      if (publishedFrom) params.set('published_from', publishedFrom)
      if (publishedTo) params.set('published_to', publishedTo)

      const response = await axios.get(`/api/v1/admin/central/announcements?${params.toString()}`)
      return {
        result: response.data.result as AnnouncementListItem[],
        total: response.data.total as number,
      }
    },
    enabled: enableFetch,
  })

  return {
    data: query.data?.result,
    total: query.data?.total,
    loading: query.isLoading,
    error: query.error,
  }
}

/** One announcement (with its church) resolved through the central scope. */
export const useCentralAnnouncement = (announcementId: string) => {
  const { data: session } = useSession()
  const query = useQuery({
    queryKey: announcementKeys.centralDetail(session?.user.user_id, announcementId),
    queryFn: async () => {
      const response = await axios.get(
        `/api/v1/admin/central/announcements/${encodeURIComponent(announcementId)}`,
      )
      return response.data.result as AnnouncementListItem
    },
    enabled: Boolean(announcementId),
  })

  return { data: query.data, loading: query.isLoading, error: query.error }
}
