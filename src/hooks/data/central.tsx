'use client'

import { useMainNotification } from '@/hooks/ui/notification'
import { GeneralHooks } from '@/models/general-hook'
import {
  ChurchPastorAssign,
  ChurchPastorPatchInput,
  ChurchPastorSummary,
  PastorCreate,
  PastorData,
  PastorUpdate,
} from '@/models/pastor'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { App } from 'antd'
import axios from 'axios'
import { useSession } from 'next-auth/react'

const centralPastorsUrl = '/api/v1/admin/central/pastors'

type PastorListOptions = Pick<
  GeneralHooks,
  'search' | 'enableFetch' | 'limit' | 'page' | 'orderDirection'
> & {
  orderBy?: 'name' | 'introduction' | 'staff_account' | 'churches'
  assignment?: 'assigned' | 'unassigned'
  staffAssignment?: 'assigned' | 'unassigned'
}

type StaffOption = {
  id: string
  name: string
  email: string
}

export const pastorKeys = {
  lists: (userId: string | undefined) => ['central', 'pastors', userId] as const,
  details: (userId: string | undefined) => ['central', 'pastor', userId] as const,
  detail: (userId: string | undefined, pastorId: string) =>
    [...pastorKeys.details(userId), pastorId] as const,
  churchAssignments: (userId: string | undefined, churchId: string) =>
    ['church', 'pastors', userId, churchId] as const,
}

const invalidatePastorRelationshipCaches = async ({
  queryClient,
  userId,
  churchId,
}: {
  queryClient: QueryClient
  userId: string | undefined
  churchId: string
}) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: pastorKeys.lists(userId) }),
    queryClient.invalidateQueries({ queryKey: pastorKeys.details(userId) }),
    queryClient.invalidateQueries({ queryKey: pastorKeys.churchAssignments(userId, churchId) }),
  ])
}

const usePastorNotifications = () => {
  const notification = useMainNotification()
  const { notification: antdNotification } = App.useApp()

  const mutationError = (error: unknown, entity: string, action: string) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const data = error.response?.data as
        | { error_code?: string; details?: string; message?: string }
        | undefined
      if (data?.error_code === 'STALE_VERSION') {
        antdNotification.error({
          title: 'Version Conflict',
          description: data.details ?? 'This record changed. Refresh and try again.',
        })
        return
      }
      if (status === 409 || status === 422) {
        antdNotification.error({
          title: status === 409 ? 'Conflict' : 'Invalid Pastor Data',
          description: data?.details ?? data?.message ?? 'Review the pastor data and try again.',
        })
        return
      }
    }
    notification({ type: 'error', entity, action })
  }

  return { notification, mutationError }
}

export const usePastors = ({
  search,
  enableFetch = true,
  limit = 10,
  page = 1,
  orderDirection = 'asc',
  orderBy = 'name',
  assignment,
  staffAssignment,
}: PastorListOptions = {}) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const { notification, mutationError } = usePastorNotifications()

  const query = useQuery({
    queryKey: [
      ...pastorKeys.lists(userId),
      { search, limit, page, orderDirection, orderBy, assignment, staffAssignment },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit === 'ALL' ? 100 : limit),
        order_by: orderBy,
        order_direction: orderDirection,
      })
      if (search?.trim()) params.set('search', search.trim())
      if (assignment) params.set('assignment', assignment)
      if (staffAssignment) params.set('staff_assignment', staffAssignment)

      const response = await axios.get(centralPastorsUrl, { params })
      return {
        result: response.data.result as PastorData[],
        total: response.data.total as number,
      }
    },
    enabled: enableFetch,
  })

  const create = useMutation({
    mutationFn: async (payload: PastorCreate) => axios.post(centralPastorsUrl, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: pastorKeys.lists(userId) })
      notification({ type: 'success', entity: 'Pastor', action: 'created' })
    },
    onError: (error) => mutationError(error, 'Pastor', 'create'),
  })

  const remove = useMutation({
    mutationFn: async (pastorId: string) => axios.delete(`${centralPastorsUrl}/${pastorId}`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pastorKeys.lists(userId) }),
        queryClient.invalidateQueries({ queryKey: pastorKeys.details(userId) }),
      ])
      notification({ type: 'success', entity: 'Pastor', action: 'deleted' })
    },
    onError: (error) => mutationError(error, 'Pastor', 'delete'),
  })

  const update = useMutation({
    mutationFn: async ({ pastorId, payload }: { pastorId: string; payload: PastorUpdate }) =>
      axios.patch(`${centralPastorsUrl}/${pastorId}`, payload),
    onSuccess: async (_result, { pastorId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pastorKeys.lists(userId) }),
        queryClient.invalidateQueries({ queryKey: pastorKeys.detail(userId, pastorId) }),
      ])
      notification({ type: 'success', entity: 'Pastor', action: 'updated' })
    },
    onError: (error) => mutationError(error, 'Pastor', 'update'),
  })

  return {
    data: query.data?.result,
    total: query.data?.total,
    loading: query.isLoading || create.isPending || remove.isPending || update.isPending,
    error: query.error,
    onCreate: create.mutateAsync,
    onUpdate: update.mutateAsync,
    onDelete: remove.mutateAsync,
  }
}

export const useCentralChurches = (enabled = true) => {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ['central', 'church-options', session?.user.user_id],
    queryFn: async () => {
      const response = await axios.get('/api/v1/admin/central/churches', {
        params: { page: 1, limit: 100, order_by: 'name', order_direction: 'asc' },
      })
      return response.data.result as Array<{ id: string; name: string; status: string }>
    },
    enabled,
  })
}

export const useAssignPastorToChurch = () => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const { notification, mutationError } = usePastorNotifications()
  const mutation = useMutation({
    mutationFn: async ({
      churchId,
      assigned,
    }: {
      churchId: string
      assigned: ChurchPastorAssign['assigned'][number]
    }) =>
      axios.post(`/api/v1/admin/central/churches/${churchId}/pastors`, {
        assigned: [assigned],
      }),
    onSuccess: async (_result, { churchId }) => {
      await invalidatePastorRelationshipCaches({ queryClient, userId, churchId })
      notification({ type: 'success', entity: 'Pastor assignment', action: 'saved' })
    },
    onError: (error) => mutationError(error, 'Pastor assignment', 'save'),
  })
  return { onAssign: mutation.mutateAsync, loading: mutation.isPending }
}

export const useUnassignPastorFromChurch = () => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const { notification, mutationError } = usePastorNotifications()
  const mutation = useMutation({
    mutationFn: async ({ churchId, pastorId }: { churchId: string; pastorId: string }) =>
      axios.delete(
        `/api/v1/admin/central/churches/${churchId}/pastors?pastorId=${encodeURIComponent(pastorId)}`,
      ),
    onSuccess: async (_result, { churchId }) => {
      await invalidatePastorRelationshipCaches({ queryClient, userId, churchId })
      notification({ type: 'success', entity: 'Pastor assignment', action: 'removed' })
    },
    onError: (error) => mutationError(error, 'Pastor assignment', 'remove'),
  })
  return { onUnassign: mutation.mutateAsync, loading: mutation.isPending }
}

export const usePastor = (pastorId: string) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const { notification, mutationError } = usePastorNotifications()
  const detailKey = pastorKeys.detail(userId, pastorId)

  const query = useQuery({
    queryKey: detailKey,
    queryFn: async () => {
      const response = await axios.get(`${centralPastorsUrl}/${pastorId}`)
      return response.data.result as PastorData
    },
    enabled: Boolean(pastorId),
  })

  const update = useMutation({
    mutationFn: async (payload: PastorUpdate) =>
      axios.patch(`${centralPastorsUrl}/${pastorId}`, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pastorKeys.lists(userId) }),
        queryClient.invalidateQueries({ queryKey: detailKey }),
      ])
      notification({ type: 'success', entity: 'Pastor', action: 'updated' })
    },
    onError: (error) => mutationError(error, 'Pastor', 'update'),
  })

  return {
    data: query.data,
    loading: query.isLoading || update.isPending,
    error: query.error,
    onUpdate: update.mutateAsync,
  }
}

export const usePastorStaffOptions = (enableFetch = true) => {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ['central', 'pastor-staff-options', session?.user.user_id],
    queryFn: async () => {
      const response = await axios.get('/api/v1/users', {
        params: {
          page: 1,
          limit: 100,
          order_by: 'name',
          order_direction: 'asc',
        },
      })
      return response.data.result as StaffOption[]
    },
    enabled: enableFetch,
  })
}

export const useChurchPastorAssignments = ({
  churchId,
  enableFetch = true,
}: {
  churchId: string
  enableFetch?: boolean
}) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const { notification, mutationError } = usePastorNotifications()
  const key = pastorKeys.churchAssignments(userId, churchId)

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const response = await axios.get(`/api/v1/admin/churches/${churchId}/pastors`)
      return response.data.result as ChurchPastorSummary[]
    },
    enabled: enableFetch && Boolean(churchId),
  })

  const replace = useMutation({
    mutationFn: async (payload: ChurchPastorAssign) =>
      axios.put(`/api/v1/admin/central/churches/${churchId}/pastors`, payload),
    onSuccess: async () => {
      await invalidatePastorRelationshipCaches({ queryClient, userId, churchId })
      notification({ type: 'success', entity: 'Pastor assignments', action: 'updated' })
    },
    onError: (error) => mutationError(error, 'Pastor assignments', 'update'),
  })

  const update = useMutation({
    mutationFn: async ({
      pastorId,
      payload,
    }: {
      pastorId: string
      payload: ChurchPastorPatchInput
    }) => {
      const response = await axios.patch(
        `/api/v1/admin/churches/${churchId}/pastors/${pastorId}`,
        payload,
      )
      return response.data.result as ChurchPastorSummary
    },
    onSuccess: async () => {
      await Promise.all([
        invalidatePastorRelationshipCaches({ queryClient, userId, churchId }),
        queryClient.invalidateQueries({ queryKey: ['churches', 'profile', churchId] }),
      ])
      notification({ type: 'success', entity: 'Pastor assignment', action: 'updated' })
    },
    onError: (error) => mutationError(error, 'Pastor assignment', 'update'),
  })

  return {
    data: query.data,
    loading: query.isLoading || replace.isPending || update.isPending,
    fetching: query.isLoading,
    updating: replace.isPending || update.isPending,
    error: query.error,
    onReplace: replace.mutateAsync,
    onUpdate: update.mutateAsync,
  }
}
