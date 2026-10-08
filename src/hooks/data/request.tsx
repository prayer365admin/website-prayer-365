'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import { REQUEST_KINDS, RequestListSummary, RequestOutput } from '@/models/request'

/*
 * F7RQ request hooks (RQ-03). Read-only: requests have no mutation endpoints
 * (D3). Keys carry userId + churchId so a user/church switch never reuses
 * cached request data. A 404 means "missing or not permitted" (the server
 * hides which), so it is surfaced as `notFound` and never retried.
 */

export type RequestKind = (typeof REQUEST_KINDS)[number]

const requestsUrl = (churchId: string) =>
  '/api/v1/admin/churches/' + encodeURIComponent(churchId) + '/requests'

export type RequestListFilters = {
  kinds?: RequestKind[]
  page: number
  limit: number
  orderDirection: 'asc' | 'desc'
}

export type RequestListOptions = Partial<RequestListFilters> & {
  churchId: string
  enableFetch?: boolean
}

export const requestKeys = {
  lists: (userId: string | undefined, churchId: string) =>
    ['church', 'requests', userId, churchId] as const,
  list: (userId: string | undefined, churchId: string, filters: RequestListFilters) =>
    [...requestKeys.lists(userId, churchId), 'list', filters] as const,
  detail: (userId: string | undefined, churchId: string, requestId: string) =>
    [...requestKeys.lists(userId, churchId), 'detail', requestId] as const,
}

const isNotFound = (error: unknown) => axios.isAxiosError(error) && error.response?.status === 404

// Retry transient failures only; 401/403/404/422 will not change on retry.
const retryTransient = (failureCount: number, error: unknown) =>
  failureCount < 2 && !(axios.isAxiosError(error) && (error.response?.status ?? 500) < 500)

export const useRequests = ({
  churchId,
  kinds,
  page = 1,
  limit = 25,
  orderDirection = 'desc',
  enableFetch = true,
}: RequestListOptions) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const filters: RequestListFilters = { kinds, page, limit, orderDirection }

  const query = useQuery({
    queryKey: requestKeys.list(userId, churchId, filters),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        order_by: 'created_at',
        order_direction: orderDirection,
      })
      if (kinds?.length) params.set('kind', kinds.join(','))
      const response = await axios.get(`${requestsUrl(churchId)}?${params.toString()}`)
      return {
        result: response.data.result as RequestListSummary[],
        total: response.data.total as number,
      }
    },
    enabled: enableFetch && Boolean(churchId),
    retry: retryTransient,
    // Keep the current page visible while the next one loads.
    placeholderData: keepPreviousData,
  })

  return {
    data: query.data?.result,
    total: query.data?.total,
    loading: query.isLoading,
    fetching: query.isFetching,
    error: query.error,
    notFound: isNotFound(query.error),
  }
}

export const useRequest = ({ churchId, requestId }: { churchId: string; requestId: string }) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id

  const query = useQuery({
    queryKey: requestKeys.detail(userId, churchId, requestId),
    queryFn: async () => {
      const response = await axios.get(`${requestsUrl(churchId)}/${encodeURIComponent(requestId)}`)
      return response.data.result as RequestOutput
    },
    enabled: Boolean(churchId && requestId),
    retry: retryTransient,
    // Sensitive detail: drop it from memory soon after the page unmounts.
    gcTime: 60 * 1000,
  })

  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    notFound: isNotFound(query.error),
  }
}
