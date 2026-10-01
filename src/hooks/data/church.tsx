import { App } from 'antd'
import { useMainNotification } from '@/hooks/ui/notification'
import { GeneralHooks } from '@/models/general-hook'
import {
  ChurchOverview,
  ChurchProfileInput,
  ChurchProfileOutput,
  ChurchSummary,
} from '@/models/church'
import { ServiceTimeEntry, ServiceTimeScheduleInput } from '@/models/service-time'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useCallback } from 'react'

const baseUrl = '/api/v1/admin/churches'

export const useChurches = ({
  queryString,
  enableFetch = true,
  limit,
  page,
  orderBy,
  orderDirection,
  search,
}: GeneralHooks & { search?: string }) => {
  const paginationQuery = `limit=${limit && limit !== 'ALL' ? limit : ''}&page=${limit && limit !== 'ALL' ? page : ''}&order_by=${orderBy}&order_direction=${orderDirection}`
  const searchQuery = search ? `&search=${encodeURIComponent(search)}` : ''

  const { data: data, isLoading: fetchLoading } = useQuery({
    queryKey: ['churches', queryString, paginationQuery, search],
    queryFn: async () => {
      const result = await axios.get(`${baseUrl}?${queryString}&${paginationQuery}${searchQuery}`)
      return {
        result: result.data.result as ChurchSummary[],
        total: result.data.total as number,
      }
    },
    enabled: !!enableFetch,
  })

  return { data: data?.result, total: data?.total, loading: fetchLoading }
}

export const useChurchOverview = (churchId: string) => {
  const { data: data, isLoading: fetchLoading } = useQuery({
    queryKey: ['churches', 'overview', churchId],
    queryFn: async () => {
      const result = await axios.get(`${baseUrl}/${churchId}/overview`)
      return result.data.result as ChurchOverview
    },
    enabled: !!churchId,
  })

  return { data, loading: fetchLoading }
}

/** CH-03 "detail": same queryKey as overview → one HTTP request; project `church`. */
export const useChurch = (churchId: string) => {
  const { data: data, isLoading: fetchLoading } = useQuery({
    queryKey: ['churches', 'overview', churchId],
    queryFn: async () => {
      const result = await axios.get(`${baseUrl}/${churchId}/overview`)
      return result.data.result as ChurchOverview
    },
    select: (overview) => overview.church as ChurchSummary,
    enabled: !!churchId,
  })

  return { data, loading: fetchLoading }
}

export const useChurchProfile = (churchId: string) => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const { notification: antdNotification } = App.useApp()

  const { data: data, isLoading: fetchLoading } = useQuery({
    queryKey: ['churches', 'profile', churchId],
    queryFn: async () => {
      const result = await axios.get(`${baseUrl}/${churchId}/profile`)
      return result.data.result as ChurchProfileOutput
    },
    enabled: !!churchId,
  })

  const { mutateAsync: onUpdate, isPending: onUpdateLoading } = useMutation({
    mutationFn: useCallback(
      async (payload: ChurchProfileInput) =>
        await axios.patch(`${baseUrl}/${churchId}/profile`, payload),
      [churchId],
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['churches'] })
      notification({ type: 'success', entity: 'church profile', action: 'updated' })
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error) && error?.response?.data?.error_code === 'STALE_VERSION') {
        antdNotification.error({
          title: 'Version Conflict',
          description:
            'This church has been updated by someone else. Please refresh your browser and try again.',
        } as Record<string, unknown>)
      } else {
        notification({ type: 'error', entity: 'church profile', action: 'updated' })
      }
    },
  })

  return { data, loading: fetchLoading || onUpdateLoading, onUpdate }
}

export const useChurchServiceTimes = (churchId: string) => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const { notification: antdNotification } = App.useApp()

  const { data: data, isLoading: fetchLoading } = useQuery({
    queryKey: ['churches', 'service-times', churchId],
    queryFn: async () => {
      const result = await axios.get(`${baseUrl}/${churchId}/service-times`)
      return result.data.result as ServiceTimeEntry[]
    },
    enabled: !!churchId,
  })

  const { mutateAsync: onReplace, isPending: onReplaceLoading } = useMutation({
    mutationFn: useCallback(
      async (payload: ServiceTimeScheduleInput) =>
        await axios.put(`${baseUrl}/${churchId}/service-times`, payload),
      [churchId],
    ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['churches'] })
      return result
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error) && error?.response?.data?.error_code === 'STALE_VERSION') {
        antdNotification.error({
          title: 'Version Conflict',
          description:
            'The service schedule has been updated by someone else. Please refresh your browser and try again.',
        } as Record<string, unknown>)
      } else {
        notification({ type: 'error', entity: 'service times', action: 'updated' })
      }
    },
  })

  return { data, loading: fetchLoading || onReplaceLoading, onReplace }
}
