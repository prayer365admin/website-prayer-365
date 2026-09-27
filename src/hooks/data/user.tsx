import { useMainNotification } from '@/hooks/ui/notification'
import { GeneralHooks } from '@/models/general-hook'
import { UserDataModel, UserPayloadCreateModel, UserPayloadUpdateModel } from '@/models/user'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useCallback } from 'react'

const baseUrl = '/api/v1/users'
const entity = 'user'
const queryKey = 'users'

export const useUsers = ({
  queryString,
  enableFetch = true,
  limit,
  page,
  orderBy,
  orderDirection,
}: GeneralHooks) => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const paginationQuery = `limit=${limit && limit !== 'ALL' ? limit : ''}&page=${limit && limit !== 'ALL' ? page : ''}&order_by=${orderBy}&order_direction=${orderDirection}`

  const { data: data, isLoading: fetchLoading } = useQuery({
    queryKey: [queryKey, queryString, paginationQuery],
    queryFn: async () => {
      const result = await axios.get(`${baseUrl}?${queryString}&${paginationQuery}`)
      return {
        result: result.data.result as UserDataModel[],
        total: result.data.total as number,
      }
    },
    enabled: !!enableFetch,
  })

  const { mutateAsync: onCreate, isPending: onCreateLoading } = useMutation({
    mutationFn: useCallback(async (payload: UserPayloadCreateModel) => {
      return await axios.post(`${baseUrl}`, payload)
    }, []),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [queryKey] })
      notification({ type: 'success', entity: entity, action: 'created' })
      return result
    },
    onError: () => {
      notification({ type: 'error', entity: entity, action: 'created' })
    },
  })

  const { mutateAsync: onDelete, isPending: onDeleteLoading } = useMutation({
    mutationFn: useCallback(async (id: string) => {
      return await axios.delete(`${baseUrl}/${id}`)
    }, []),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [queryKey] })
      notification({ type: 'success', entity: entity, action: 'deleted' })
      return result
    },
    onError: () => {
      notification({ type: 'error', entity: entity, action: 'deleted' })
    },
  })

  return {
    data: data?.result,
    total: data?.total,
    loading: fetchLoading || onCreateLoading || onDeleteLoading,
    onCreate,
    onDelete,
  }
}

export const useUser = (id: string) => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()

  const { data: data, isLoading: fetchLoading } = useQuery({
    queryKey: [entity, id],
    queryFn: async () => {
      const result = await axios.get(`${baseUrl}/${id}`)
      return result.data.result as UserDataModel
    },
  })

  const { mutateAsync: onUpdate, isPending: onUpdateLoading } = useMutation({
    mutationFn: useCallback(
      async (payload: UserPayloadUpdateModel) => {
        return await axios.put(`${baseUrl}/${id}`, payload)
      },
      [id],
    ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [queryKey] })
      queryClient.invalidateQueries({ queryKey: [entity, id] })
      notification({ type: 'success', entity: entity, action: 'updated' })
      return result
    },
    onError: () => {
      notification({ type: 'error', entity: entity, action: 'updated' })
    },
  })

  return {
    data,
    loading: fetchLoading || onUpdateLoading || onUpdateLoading,
    onUpdate,
  }
}
