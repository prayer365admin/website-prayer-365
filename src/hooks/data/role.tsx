import { useMainNotification } from '@/hooks/ui/notification'
import { GeneralHooks } from '@/models/general-hook'
import { RoleDataModel, RolePayloadCrateModel, RolePayloadUpdateModel } from '@/models/role'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useCallback } from 'react'

const baseUrl = '/api/v1/roles'
const queryKey = 'roles'
const entity = 'role'

export const useRoles = ({
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
      return result.data.result as RoleDataModel[]
    },
    enabled: !!enableFetch,
  })

  const { mutateAsync: onCreate, isPending: onCreateLoading } = useMutation({
    mutationFn: useCallback(async (payload: RolePayloadCrateModel) => {
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
    data,
    loading: fetchLoading || onCreateLoading || onDeleteLoading,
    onCreate,
    onDelete,
  }
}

export const useRole = (id?: string) => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()

  const { data: data, isLoading: fetchLoading } = useQuery({
    queryKey: [entity, id],
    queryFn: async () => {
      const result = await axios.get(`${baseUrl}/${id}`)
      return result.data.result as RoleDataModel
    },
    enabled: !!id,
  })

  const { mutateAsync: onUpdate, isPending: onUpdateLoading } = useMutation({
    mutationFn: useCallback(
      async (payload: RolePayloadUpdateModel) => {
        return await axios.put(`${baseUrl}/${id}`, payload)
      },
      [id],
    ),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: [queryKey] })
      await queryClient.invalidateQueries({ queryKey: [entity, id] })
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
