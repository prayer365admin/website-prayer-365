'use client'

import { useMainNotification } from '@/hooks/ui/notification'
import { GeneralHooks } from '@/models/general-hook'
import { HierarchyNode, NodeCreate, NodeUpdate } from '@/models/hierarchy'
import type {
  ChurchCreate,
  ChurchDetail,
  ChurchListItem,
  ChurchPurge,
  ChurchSummary,
  ChurchUpdate,
} from '@/models/central-church'
import type { ChurchStatus } from '@prisma/client'
import {
  CountryCreate,
  CountryData,
  CountryUpdate,
  LanguageCreate,
  LanguageSummary,
  LanguageUpdate,
} from '@/models/registry'
import { RoleAssignmentCreate, RoleAssignmentSummary } from '@/models/role-assignment'
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
        { error_code?: string; details?: string; message?: string } | undefined
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
    queryKey: churchKeys.options(session?.user.user_id),
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

// --- Organization (F11ORG): hierarchy, countries, languages, role assignments ---

const centralUrl = '/api/v1/admin/central'

export const orgKeys = {
  hierarchy: (userId: string | undefined) => ['central', 'hierarchy', userId] as const,
  countries: (userId: string | undefined) => ['central', 'countries', userId] as const,
  languages: (userId: string | undefined) => ['central', 'languages', userId] as const,
  roleAssignments: (userId: string | undefined) => ['central', 'role-assignments', userId] as const,
}

/** Server `details` are already safe, readable messages (cycle, stale, escalation, …). */
const useOrgNotifications = () => {
  const notification = useMainNotification()
  const { notification: antdNotification } = App.useApp()

  const mutationError = (error: unknown, entity: string, action: string) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0
      const data = error.response?.data as { error_code?: string; details?: string } | undefined
      if (status >= 400 && status < 500 && data?.details) {
        antdNotification.error({
          title: data.error_code === 'STALE_VERSION' ? 'Version Conflict' : `Unable to ${action}`,
          description: data.details,
        })
        return
      }
    }
    notification({ type: 'error', entity, action })
  }

  return { notification, mutationError }
}

export const useHierarchy = (enableFetch = true) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const { notification, mutationError } = useOrgNotifications()

  const query = useQuery({
    queryKey: orgKeys.hierarchy(userId),
    queryFn: async () => {
      const response = await axios.get(`${centralUrl}/hierarchy`)
      return response.data.result as HierarchyNode[]
    },
    enabled: enableFetch,
  })

  // A move changes descendant reporting scope and assignment node names.
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orgKeys.hierarchy(userId) }),
      queryClient.invalidateQueries({ queryKey: orgKeys.roleAssignments(userId) }),
    ])

  const create = useMutation({
    mutationFn: async (payload: NodeCreate) => axios.post(`${centralUrl}/hierarchy`, payload),
    onSuccess: async () => {
      await invalidate()
      notification({ type: 'success', entity: 'Node', action: 'created' })
    },
    onError: (error) => mutationError(error, 'Node', 'create'),
  })

  const update = useMutation({
    mutationFn: async ({ nodeId, payload }: { nodeId: string; payload: NodeUpdate }) =>
      axios.patch(`${centralUrl}/hierarchy/${encodeURIComponent(nodeId)}`, payload),
    onSuccess: async () => {
      await invalidate()
      notification({ type: 'success', entity: 'Node', action: 'updated' })
    },
    onError: (error) => mutationError(error, 'Node', 'update'),
  })

  return {
    data: query.data,
    loading: query.isLoading,
    saving: create.isPending || update.isPending,
    error: query.error,
    onCreate: create.mutateAsync,
    onUpdate: update.mutateAsync,
  }
}

const useRegistry = <Row, Create, Update>({
  resource,
  entity,
  key,
  enableFetch,
}: {
  resource: 'countries' | 'languages'
  entity: string
  key: (userId: string | undefined) => readonly unknown[]
  enableFetch: boolean
}) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const { notification, mutationError } = useOrgNotifications()
  const url = `${centralUrl}/${resource}`

  const query = useQuery({
    queryKey: key(userId),
    queryFn: async () => {
      // ponytail: single 100-row page; paginate when a registry outgrows it.
      const response = await axios.get(url, {
        params: { page: 1, limit: 100, order_direction: 'asc' },
      })
      return response.data.result as Row[]
    },
    enabled: enableFetch,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key(userId) })

  const create = useMutation({
    mutationFn: async (payload: Create) => axios.post(url, payload),
    onSuccess: async () => {
      await invalidate()
      notification({ type: 'success', entity, action: 'created' })
    },
    onError: (error) => mutationError(error, entity, 'create'),
  })

  const update = useMutation({
    mutationFn: async ({ code, payload }: { code: string; payload: Update }) =>
      axios.patch(`${url}/${encodeURIComponent(code)}`, payload),
    onSuccess: async () => {
      await invalidate()
      notification({ type: 'success', entity, action: 'updated' })
    },
    onError: (error) => mutationError(error, entity, 'update'),
  })

  return {
    data: query.data,
    loading: query.isLoading,
    saving: create.isPending || update.isPending,
    error: query.error,
    onCreate: create.mutateAsync,
    onUpdate: update.mutateAsync,
  }
}

export const useCountries = (enableFetch = true) =>
  useRegistry<CountryData, CountryCreate, CountryUpdate>({
    resource: 'countries',
    entity: 'Country',
    key: orgKeys.countries,
    enableFetch,
  })

export const useLanguages = (enableFetch = true) =>
  useRegistry<LanguageSummary, LanguageCreate, LanguageUpdate>({
    resource: 'languages',
    entity: 'Language',
    key: orgKeys.languages,
    enableFetch,
  })

export const useRoleAssignments = ({
  userId: assigneeId,
  orgNodeId,
  enableFetch = true,
}: {
  userId?: string
  orgNodeId?: string
  enableFetch?: boolean
} = {}) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const { notification, mutationError } = useOrgNotifications()
  const url = `${centralUrl}/role-assignments`

  const query = useQuery({
    queryKey: [...orgKeys.roleAssignments(userId), { assigneeId, orgNodeId }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: '1', limit: '100', order_direction: 'desc' })
      if (assigneeId) params.set('userId', assigneeId)
      if (orgNodeId) params.set('orgNodeId', orgNodeId)
      const response = await axios.get(url, { params })
      return {
        result: response.data.result as RoleAssignmentSummary[],
        total: response.data.total as number,
      }
    },
    enabled: enableFetch,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: orgKeys.roleAssignments(userId) })

  const create = useMutation({
    mutationFn: async (payload: RoleAssignmentCreate) => axios.post(url, payload),
    onSuccess: async () => {
      await invalidate()
      notification({ type: 'success', entity: 'Assignment', action: 'granted' })
    },
    onError: (error) => mutationError(error, 'Assignment', 'grant'),
  })

  const revoke = useMutation({
    mutationFn: async (assignmentId: string) =>
      axios.delete(`${url}/${encodeURIComponent(assignmentId)}`),
    onSuccess: async () => {
      await invalidate()
      notification({ type: 'success', entity: 'Assignment', action: 'revoked' })
    },
    onError: (error) => mutationError(error, 'Assignment', 'revoke'),
  })

  return {
    data: query.data?.result,
    total: query.data?.total,
    loading: query.isLoading,
    saving: create.isPending || revoke.isPending,
    error: query.error,
    onCreate: create.mutateAsync,
    onRevoke: revoke.mutateAsync,
  }
}

// --- Central church administration (F14CC / plan 020): list, setup, lifecycle, purge ---

const centralChurchesUrl = '/api/v1/admin/central/churches'

export const churchKeys = {
  lists: (userId: string | undefined) => ['central', 'churches', userId] as const,
  details: (userId: string | undefined) => ['central', 'church', userId] as const,
  detail: (userId: string | undefined, churchId: string) =>
    [...churchKeys.details(userId), churchId] as const,
  options: (userId: string | undefined) => ['central', 'church-options', userId] as const,
}

/**
 * Every church mutation touches the list, the detail, the church-option picker
 * and — because create/purge add or remove an OrgNode — the hierarchy tree.
 */
const invalidateChurchCaches = async ({
  queryClient,
  userId,
  churchId,
}: {
  queryClient: QueryClient
  userId: string | undefined
  churchId?: string
}) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: churchKeys.lists(userId) }),
    queryClient.invalidateQueries({ queryKey: churchKeys.options(userId) }),
    queryClient.invalidateQueries({ queryKey: orgKeys.hierarchy(userId) }),
    ...(churchId
      ? [queryClient.invalidateQueries({ queryKey: churchKeys.detail(userId, churchId) })]
      : [queryClient.invalidateQueries({ queryKey: churchKeys.details(userId) })]),
  ])
}

export type CentralChurchListOptions = Pick<
  GeneralHooks,
  'search' | 'enableFetch' | 'page' | 'limit'
> & {
  status?: ChurchStatus
}

export const useCentralChurchList = ({
  search,
  status,
  enableFetch = true,
  page = 1,
  limit = 10,
}: CentralChurchListOptions = {}) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id

  const query = useQuery({
    queryKey: [...churchKeys.lists(userId), { search, status, page, limit }],
    queryFn: async () => {
      const response = await axios.get(centralChurchesUrl, {
        params: {
          page,
          limit,
          order_by: 'created_at',
          order_direction: 'desc',
          ...(status ? { status } : {}),
          ...(search?.trim() ? { search: search.trim() } : {}),
        },
      })
      return {
        result: response.data.result as ChurchListItem[],
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
    refetch: query.refetch,
  }
}

export const useCreateCentralChurch = () => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const { notification, mutationError } = useOrgNotifications()

  const create = useMutation({
    mutationFn: async (payload: ChurchCreate) => {
      const response = await axios.post(centralChurchesUrl, payload)
      return response.data.result as ChurchSummary
    },
    onSuccess: async () => {
      await invalidateChurchCaches({ queryClient, userId })
      notification({ type: 'success', entity: 'Church', action: 'created' })
    },
    onError: (error) => mutationError(error, 'Church', 'create'),
  })

  return { onCreate: create.mutateAsync, loading: create.isPending }
}

export type ChurchLifecycleAction = 'approve' | 'suspend' | 'archive'

/** Purge is id-addressed rather than hook-addressed: the list page deletes a row it has not opened. */
export const usePurgeCentralChurch = () => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const { notification, mutationError } = useOrgNotifications()

  const purge = useMutation({
    mutationFn: async ({ churchId, payload }: { churchId: string; payload: ChurchPurge }) =>
      axios.delete(`${centralChurchesUrl}/${churchId}`, { data: payload }),
    onSuccess: async (_result, { churchId }) => {
      await invalidateChurchCaches({ queryClient, userId, churchId })
      notification({ type: 'success', entity: 'Church', action: 'deleted' })
    },
    onError: (error) => mutationError(error, 'Church', 'delete'),
  })

  return { onPurge: purge.mutateAsync, loading: purge.isPending }
}

export const useCentralChurch = (churchId: string) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id
  const queryClient = useQueryClient()
  const { notification, mutationError } = useOrgNotifications()
  const detailKey = churchKeys.detail(userId, churchId)

  const query = useQuery({
    queryKey: detailKey,
    queryFn: async () => {
      const response = await axios.get(`${centralChurchesUrl}/${churchId}`)
      return response.data.result as ChurchDetail
    },
    enabled: Boolean(churchId),
  })

  const update = useMutation({
    mutationFn: async (payload: ChurchUpdate) =>
      axios.patch(`${centralChurchesUrl}/${churchId}`, payload),
    onSuccess: async () => {
      await invalidateChurchCaches({ queryClient, userId, churchId })
      notification({ type: 'success', entity: 'Church', action: 'updated' })
    },
    onError: (error) => mutationError(error, 'Church', 'update'),
  })

  const lifecycle = useMutation({
    mutationFn: async ({ action, version }: { action: ChurchLifecycleAction; version: number }) =>
      axios.post(`${centralChurchesUrl}/${churchId}/${action}`, { version }),
    onSuccess: async (_result, { action }) => {
      await invalidateChurchCaches({ queryClient, userId, churchId })
      notification({ type: 'success', entity: 'Church', action })
    },
    onError: (error) => mutationError(error, 'Church', 'update'),
  })

  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    saving: update.isPending || lifecycle.isPending,
    refetch: query.refetch,
    onUpdate: update.mutateAsync,
    onLifecycle: lifecycle.mutateAsync,
  }
}
