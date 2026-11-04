import { GeneralHooks } from '@/models/general-hook'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useCallback } from 'react'

const baseUrl = '/api/v1/customers'
const queryKey = 'customers'

export type CustomerDataModel = {
  id: string
  email: string
  name: string
  created_at: string
  status?: string
  deleted_at?: string | null
  last_login_provider?: string | null
  last_active_at?: string | null
  profile_picture?: string | null
  avatarUrl?: string | null
  email_verified_at?: string | Date | null
}

export const useCustomers = ({
  queryString = '',
  enableFetch = true,
  limit,
  page,
  orderBy,
  orderDirection,
  search,
  status,
}: GeneralHooks & { status?: string }) => {
  const queryClient = useQueryClient()
  const paginationQuery = `limit=${limit && limit !== 'ALL' ? limit : ''}&page=${limit && limit !== 'ALL' ? page : ''}&order_by=${orderBy}&order_direction=${orderDirection}`
  const statusQuery = status ? `&status=${encodeURIComponent(status)}` : ''
  const searchQuery = search ? `&search=${encodeURIComponent(search)}` : ''

  const {
    data,
    isLoading: fetchLoading,
    isFetching: fetchFetching,
  } = useQuery({
    queryKey: [queryKey, queryString, paginationQuery, status, search],
    queryFn: async () => {
      const result = await axios.get(
        `${baseUrl}?${queryString}&${paginationQuery}${statusQuery}${searchQuery}`,
      )
      return {
        result: result.data.result as CustomerDataModel[],
        total: result.data.total as number,
      }
    },
    enabled: !!enableFetch,
  })

  return {
    data: data?.result,
    total: data?.total,
    loading: fetchLoading,
    fetching: fetchFetching,
    onRevalidate: useCallback(
      () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
      [queryClient],
    ),
  }
}
