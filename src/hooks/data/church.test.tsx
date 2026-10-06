import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from 'antd'
import {
  axiosMock,
  createTestQueryClient,
  Providers,
  resolveGet,
  sessionMock,
} from '@/test/frontend/render'
import {
  useChurches,
  useChurchOverview,
  useChurch,
  useCurrentChurch,
  useChurchProfile,
  useChurchServiceTimes,
} from './church'

const church = {
  id: 'c1',
  name: 'Grace',
  status: 'APPROVED',
  timezone: 'Europe/Tallinn',
  city: 'Tallinn',
  version: 3,
}
const churches = [
  church,
  { id: 'c2', name: 'Hope', status: 'PENDING', timezone: 'Europe/Tallinn', city: null, version: 1 },
]
const profile = {
  id: 'c1',
  name: 'Grace',
  description: null,
  denomination: null,
  address: { line1: 'A', city: 'Tallinn', countryCode: 'EE' },
  coordinates: null,
  timezone: 'Europe/Tallinn',
  contacts: {},
  website: null,
  socialLinks: [],
  languageCodes: ['et'],
  accessibility: null,
  coverAssetId: null,
  status: 'APPROVED',
  version: 3,
}
const overview = {
  church,
  aggregates: {
    serviceTimeCount: 2,
    pastorCount: 1,
    prayerCount: 5,
    eventCount: 0,
    announcementDraftCount: 0,
    announcementPublishedCount: 0,
    memberCount: 40,
    mediaCount: 1,
  },
  requests: undefined,
}
const schedule = [
  { id: 'st1', weekday: 7, localTime: '11:00', label: 'Main service', languageCode: 'et' },
]

describe('church data hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockReturnValue({
      data: { user: { user_id: 'user-1' } },
      status: 'authenticated',
    })
  })

  it('useChurches fetches with pagination', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet(churches, 2) })
    const { result } = renderHook(
      () =>
        useChurches({
          queryString: 'search=grace',
          limit: 10,
          page: 2,
          orderBy: 'name',
          orderDirection: 'asc',
        }),
      { wrapper: Providers },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(churches)
    expect(result.current.total).toBe(2)
    expect(axiosMock.get).toHaveBeenCalledWith(
      '/api/v1/admin/churches?search=grace&limit=10&page=2&order_by=name&order_direction=asc',
    )
  })

  it("useChurches 'ALL' limit omits limit/page", async () => {
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet(churches, 2) })
    const { result } = renderHook(
      () =>
        useChurches({
          queryString: '',
          limit: 'ALL',
          page: 2,
          orderBy: 'name',
          orderDirection: 'asc',
        }),
      { wrapper: Providers },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(axiosMock.get).toHaveBeenCalledWith(
      '/api/v1/admin/churches?&limit=&page=&order_by=name&order_direction=asc',
    )
  })

  it('useChurches enableFetch: false → axiosMock.get never called', () => {
    renderHook(
      () =>
        useChurches({
          queryString: '',
          enableFetch: false,
          limit: 10,
          page: 1,
          orderBy: 'name',
          orderDirection: 'asc',
        }),
      { wrapper: Providers },
    )
    expect(axiosMock.get).not.toHaveBeenCalled()
  })

  it('does not reuse assigned churches when the authenticated user changes', async () => {
    const client = createTestQueryClient()
    let userId = 'user-1'
    sessionMock.mockImplementation(() => ({
      data: { user: { user_id: userId } },
      status: 'authenticated',
    }))
    axiosMock.get
      .mockResolvedValueOnce({ data: resolveGet([church], 1) })
      .mockResolvedValueOnce({ data: resolveGet([churches[1]], 1) })

    const { result, rerender } = renderHook(
      () =>
        useChurches({
          queryString: '',
          limit: 100,
          page: 1,
          orderBy: 'name',
          orderDirection: 'asc',
        }),
      { wrapper: ({ children }) => <Providers client={client}>{children}</Providers> },
    )
    await waitFor(() => expect(result.current.data?.[0].id).toBe('c1'))

    userId = 'user-2'
    rerender()
    await waitFor(() => expect(result.current.data?.[0].id).toBe('c2'))

    expect(axiosMock.get).toHaveBeenCalledTimes(2)
  })

  it('useChurchOverview fetches and returns overview object', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: { result: overview } })
    const { result } = renderHook(() => useChurchOverview('c1'), { wrapper: Providers })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(overview)
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/admin/churches/c1/overview')
  })

  it('useChurch projects summary from the shared overview cache', async () => {
    // Both hooks use the same query key. The first call to trigger fetch will resolve.
    axiosMock.get.mockResolvedValueOnce({ data: { result: overview } })
    const { result } = renderHook(
      () => ({
        overview: useChurchOverview('c1'),
        church: useChurch('c1'),
      }),
      { wrapper: Providers },
    )
    await waitFor(() => expect(result.current.overview.loading).toBe(false))
    expect(axiosMock.get).toHaveBeenCalledTimes(1)
    expect(result.current.overview.data).toEqual(overview)
    expect(result.current.church.data).toEqual(church)
  })

  it('useCurrentChurch reads the profile and shares its cache with useChurchProfile', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: { result: profile } })
    const { result } = renderHook(
      () => ({ current: useCurrentChurch('c1'), profile: useChurchProfile('c1') }),
      { wrapper: Providers },
    )
    await waitFor(() => expect(result.current.current.loading).toBe(false))
    expect(result.current.current.data).toEqual(profile)
    expect(result.current.profile.data).toEqual(profile)
    expect(axiosMock.get).toHaveBeenCalledTimes(1)
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/admin/churches/c1/profile')
  })

  it('useChurchProfile fetches and returns profile', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: { result: profile } })
    const { result } = renderHook(() => useChurchProfile('c1'), { wrapper: Providers })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(profile)
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/admin/churches/c1/profile')
  })

  it('useChurchProfile patch updates and invalidates', async () => {
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useChurchProfile('c1'), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    })

    axiosMock.patch.mockResolvedValueOnce({ data: {} })
    await result.current.onUpdate(profile as never)

    expect(axiosMock.patch).toHaveBeenCalledWith('/api/v1/admin/churches/c1/profile', profile)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['churches'] })
  })

  it('useChurchServiceTimes fetches and returns schedule array', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: { result: schedule } })
    const { result } = renderHook(() => useChurchServiceTimes('c1'), { wrapper: Providers })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(schedule)
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/admin/churches/c1/service-times')
  })

  it('useChurchServiceTimes put updates and invalidates', async () => {
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useChurchServiceTimes('c1'), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    })

    axiosMock.put.mockResolvedValueOnce({ data: {} })
    const payload = { version: 3, schedule: [{ weekday: 7, localTime: '11:00' }] }
    await result.current.onReplace(payload as never)

    expect(axiosMock.put).toHaveBeenCalledWith('/api/v1/admin/churches/c1/service-times', payload)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['churches'] })
  })

  it('useChurchServiceTimes error contract (409): displays STALE_VERSION custom notification', async () => {
    const mockError = vi.fn()
    const useAppSpy = vi.spyOn(App, 'useApp').mockReturnValue({
      notification: { error: mockError, success: vi.fn() },
    } as unknown as ReturnType<typeof App.useApp>)

    const { result } = renderHook(() => useChurchServiceTimes('c1'), { wrapper: Providers })

    const staleError = new Error('Conflict') as Error & { isAxiosError: boolean; response: unknown }
    staleError.isAxiosError = true
    staleError.response = { data: { error_code: 'STALE_VERSION' } }
    axiosMock.put.mockRejectedValueOnce(staleError)

    const payload = { version: 1, schedule: [] }
    await expect(result.current.onReplace(payload as never)).rejects.toThrow()

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Version Conflict',
        description: expect.stringContaining('Please refresh your browser'),
      }),
    )

    useAppSpy.mockRestore()
  })
})

it('useChurchProfile error contract (409): displays STALE_VERSION custom notification', async () => {
  const mockError = vi.fn()
  const useAppSpy = vi.spyOn(App, 'useApp').mockReturnValue({
    notification: { error: mockError, success: vi.fn() },
  } as unknown as ReturnType<typeof App.useApp>)

  const { result } = renderHook(() => useChurchProfile('c1'), { wrapper: Providers })

  // Construct a proper fake AxiosError
  const staleError = new Error('Conflict') as Error & { isAxiosError: boolean; response: unknown }
  staleError.isAxiosError = true
  staleError.response = { data: { error_code: 'STALE_VERSION' } }
  axiosMock.patch.mockRejectedValueOnce(staleError)

  // The promise rejects because react-query propagates the error out of mutateAsync
  await expect(result.current.onUpdate(profile as never)).rejects.toThrow()

  expect(mockError).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Version Conflict',
      description: expect.stringContaining('Please refresh your browser'),
    }),
  )

  useAppSpy.mockRestore()
})
