import { act, renderHook, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axiosMock, createTestQueryClient, Providers, sessionMock } from '@/test/frontend/render'
import {
  orgKeys,
  pastorKeys,
  useAssignPastorToChurch,
  useChurchPastorAssignments,
  usePastor,
  usePastors,
  useCountries,
  useHierarchy,
  useLanguages,
  useRoleAssignments,
  useUnassignPastorFromChurch,
} from './central'

const pastorId = '00000000-0000-0000-0000-000000000001'
const pastor = {
  id: pastorId,
  version: 2,
  name: 'Pastor A',
  introduction: null,
  user_id: null,
  churches: [],
}
const assignment = {
  id: pastorId,
  name: 'Pastor A',
  introduction: null,
  pastoralRole: 'Pastor',
  imageAssetId: null,
}

describe('central pastor data hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockReturnValue({
      data: { user: { user_id: 'user-1' } },
      status: 'authenticated',
    })
  })

  it('keeps central pastor list caches scoped to the authenticated user', async () => {
    const client = createTestQueryClient()
    axiosMock.get.mockResolvedValue({ data: { result: [pastor], total: 1 } })

    const { result } = renderHook(() => usePastors(), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    })

    await waitFor(() => expect(result.current.data).toEqual([pastor]))
    expect(
      client.getQueryCache().find({ queryKey: pastorKeys.lists('user-1'), exact: false }),
    ).toBeDefined()
  })

  it('invalidates central list and detail caches after a central profile update', async () => {
    const client = createTestQueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    axiosMock.get.mockResolvedValue({ data: { result: pastor } })
    axiosMock.patch.mockResolvedValue({ data: { result: { ...pastor, version: 3 } } })

    const { result } = renderHook(() => usePastor(pastorId), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    })
    await waitFor(() => expect(result.current.data).toEqual(pastor))

    await act(async () => {
      await result.current.onUpdate({ version: 2, name: 'Updated' })
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: pastorKeys.lists('user-1') })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: pastorKeys.detail('user-1', pastorId),
    })
  })

  it('shows linked-user conflicts from the central profile API', async () => {
    const errorNotification = vi.fn()
    const useApp = vi.spyOn(App, 'useApp').mockReturnValue({
      notification: { error: errorNotification, success: vi.fn() },
    } as unknown as ReturnType<typeof App.useApp>)
    axiosMock.get.mockResolvedValue({ data: { result: pastor } })
    const error = new Error('Conflict') as Error & { isAxiosError: boolean; response: unknown }
    error.isAxiosError = true
    error.response = {
      status: 409,
      data: {
        error_code: 'LINKED_USER_TAKEN',
        details: 'This user is already linked to another pastor profile.',
      },
    }
    axiosMock.patch.mockRejectedValueOnce(error)

    const { result } = renderHook(() => usePastor(pastorId), { wrapper: Providers })
    await waitFor(() => expect(result.current.data).toEqual(pastor))
    await expect(result.current.onUpdate({ version: 2, userId: 'user-2' })).rejects.toThrow()

    expect(errorNotification).toHaveBeenCalledWith({
      title: 'Conflict',
      description: 'This user is already linked to another pastor profile.',
    })
    useApp.mockRestore()
  })

  it('fetches church assignments and PATCHes church-specific fields through one hook', async () => {
    const client = createTestQueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    axiosMock.get.mockResolvedValue({ data: { result: [assignment] } })
    axiosMock.patch.mockResolvedValue({
      data: { result: { ...assignment, pastoralRole: 'Lead Pastor' } },
    })

    const { result } = renderHook(() => useChurchPastorAssignments({ churchId: 'church-1' }), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    })
    await waitFor(() => expect(result.current.data).toEqual([assignment]))

    await act(async () => {
      await result.current.onUpdate({
        pastorId,
        payload: { version: 3, pastoral_role: 'Lead Pastor', image_asset_id: null },
      })
    })

    expect(axiosMock.patch).toHaveBeenCalledWith(
      `/api/v1/admin/churches/church-1/pastors/${pastorId}`,
      { version: 3, pastoral_role: 'Lead Pastor', image_asset_id: null },
    )
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: pastorKeys.churchAssignments('user-1', 'church-1'),
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['churches', 'profile', 'church-1'],
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: pastorKeys.lists('user-1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: pastorKeys.details('user-1') })
  })

  it('invalidates all relationship consumers after assign and unassign mutations', async () => {
    const client = createTestQueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    axiosMock.post.mockResolvedValue({ data: { result: assignment } })
    axiosMock.delete.mockResolvedValue({ data: {} })

    const { result } = renderHook(
      () => ({ assign: useAssignPastorToChurch(), unassign: useUnassignPastorFromChurch() }),
      { wrapper: ({ children }) => <Providers client={client}>{children}</Providers> },
    )

    await act(async () => {
      await result.current.assign.onAssign({ churchId: 'church-1', assigned: { pastorId } })
      await result.current.unassign.onUnassign({ churchId: 'church-1', pastorId })
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: pastorKeys.lists('user-1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: pastorKeys.details('user-1') })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: pastorKeys.churchAssignments('user-1', 'church-1'),
    })
  })

  it('shows the server details for a 422 assignment error', async () => {
    const errorNotification = vi.fn()
    const useApp = vi.spyOn(App, 'useApp').mockReturnValue({
      notification: { error: errorNotification, success: vi.fn() },
    } as unknown as ReturnType<typeof App.useApp>)
    axiosMock.get.mockResolvedValue({ data: { result: [assignment] } })
    const error = new Error('Unprocessable') as Error & {
      isAxiosError: boolean
      response: unknown
    }
    error.isAxiosError = true
    error.response = {
      status: 422,
      data: { error_code: 'INVALID_IMAGE_ASSET', details: 'Image must belong to this church.' },
    }
    axiosMock.patch.mockRejectedValueOnce(error)

    const { result } = renderHook(() => useChurchPastorAssignments({ churchId: 'church-1' }), {
      wrapper: Providers,
    })
    await waitFor(() => expect(result.current.data).toEqual([assignment]))

    await expect(
      result.current.onUpdate({ pastorId, payload: { version: 3, pastoral_role: 'Pastor' } }),
    ).rejects.toThrow()
    expect(errorNotification).toHaveBeenCalledWith({
      title: 'Invalid Pastor Data',
      description: 'Image must belong to this church.',
    })
    useApp.mockRestore()
  })

  it('shows a refreshable conflict message for stale assignment versions', async () => {
    const errorNotification = vi.fn()
    const useApp = vi.spyOn(App, 'useApp').mockReturnValue({
      notification: { error: errorNotification, success: vi.fn() },
    } as unknown as ReturnType<typeof App.useApp>)
    axiosMock.get.mockResolvedValue({ data: { result: [assignment] } })
    const error = new Error('Conflict') as Error & { isAxiosError: boolean; response: unknown }
    error.isAxiosError = true
    error.response = {
      status: 409,
      data: { error_code: 'STALE_VERSION', details: 'Refresh this church and try again.' },
    }
    axiosMock.patch.mockRejectedValueOnce(error)

    const { result } = renderHook(() => useChurchPastorAssignments({ churchId: 'church-1' }), {
      wrapper: Providers,
    })
    await waitFor(() => expect(result.current.data).toEqual([assignment]))

    await expect(
      result.current.onUpdate({ pastorId, payload: { version: 2, pastoral_role: 'Pastor' } }),
    ).rejects.toThrow()
    expect(errorNotification).toHaveBeenCalledWith({
      title: 'Version Conflict',
      description: 'Refresh this church and try again.',
    })
    useApp.mockRestore()
  })
})

describe('central organization data hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockReturnValue({
      data: { user: { user_id: 'user-1' } },
      status: 'authenticated',
    })
  })

  const tree = [
    {
      id: 'root',
      kind: 'GLOBAL',
      name: 'Global',
      parentId: null,
      countryCode: null,
      version: 1,
      children: [],
    },
  ]

  it('loads the hierarchy under a user-scoped key and moves a node with its version', async () => {
    const client = createTestQueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    axiosMock.get.mockResolvedValue({ data: { result: tree } })
    axiosMock.patch.mockResolvedValue({ data: { result: { id: 'dn' } } })

    const { result } = renderHook(() => useHierarchy(), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    })
    await waitFor(() => expect(result.current.data).toEqual(tree))
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/admin/central/hierarchy')
    expect(client.getQueryCache().find({ queryKey: orgKeys.hierarchy('user-1') })).toBeDefined()

    await act(async () => {
      await result.current.onUpdate({ nodeId: 'dn', payload: { version: 3, parentId: 'dc2' } })
    })
    expect(axiosMock.patch).toHaveBeenCalledWith('/api/v1/admin/central/hierarchy/dn', {
      version: 3,
      parentId: 'dc2',
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: orgKeys.hierarchy('user-1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: orgKeys.roleAssignments('user-1') })
  })

  it('surfaces server details for a rejected cycle', async () => {
    const errorNotification = vi.fn()
    const useApp = vi.spyOn(App, 'useApp').mockReturnValue({
      notification: { error: errorNotification, success: vi.fn() },
    } as unknown as ReturnType<typeof App.useApp>)
    axiosMock.get.mockResolvedValue({ data: { result: tree } })
    const error = new Error('Bad') as Error & { isAxiosError: boolean; response: unknown }
    error.isAxiosError = true
    error.response = {
      status: 400,
      data: { error_code: 'HIERARCHY_CYCLE', details: 'The proposed parent would create a cycle.' },
    }
    axiosMock.patch.mockRejectedValueOnce(error)

    const { result } = renderHook(() => useHierarchy(), { wrapper: Providers })
    await waitFor(() => expect(result.current.data).toEqual(tree))
    await expect(
      result.current.onUpdate({ nodeId: 'ct', payload: { version: 1, parentId: 'dc' } }),
    ).rejects.toThrow()
    expect(errorNotification).toHaveBeenCalledWith({
      title: 'Unable to update',
      description: 'The proposed parent would create a cycle.',
    })
    useApp.mockRestore()
  })

  it('patches countries and languages by code with version', async () => {
    axiosMock.get.mockResolvedValue({ data: { result: [] } })
    axiosMock.patch.mockResolvedValue({ data: { result: {} } })

    const countries = renderHook(() => useCountries(), { wrapper: Providers })
    const languages = renderHook(() => useLanguages(), { wrapper: Providers })
    await waitFor(() => expect(countries.result.current.data).toEqual([]))
    await waitFor(() => expect(languages.result.current.data).toEqual([]))

    await act(async () => {
      await countries.result.current.onUpdate({
        code: 'EE',
        payload: { version: 2, enabled: false },
      })
      await languages.result.current.onUpdate({
        code: 'et',
        payload: { version: 1, enabled: true },
      })
    })
    expect(axiosMock.patch).toHaveBeenCalledWith('/api/v1/admin/central/countries/EE', {
      version: 2,
      enabled: false,
    })
    expect(axiosMock.patch).toHaveBeenCalledWith('/api/v1/admin/central/languages/et', {
      version: 1,
      enabled: true,
    })
  })

  it('filters assignments by user and revokes by id', async () => {
    axiosMock.get.mockResolvedValue({ data: { result: [], total: 0 } })
    axiosMock.delete.mockResolvedValue({ data: { result: {} } })

    const { result } = renderHook(() => useRoleAssignments({ userId: 'staff-1' }), {
      wrapper: Providers,
    })
    await waitFor(() => expect(result.current.data).toEqual([]))
    const params = axiosMock.get.mock.calls[0][1].params as URLSearchParams
    expect(params.get('userId')).toBe('staff-1')

    await act(async () => {
      await result.current.onRevoke('a-1')
    })
    expect(axiosMock.delete).toHaveBeenCalledWith('/api/v1/admin/central/role-assignments/a-1')
  })
})
