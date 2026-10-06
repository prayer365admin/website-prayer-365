import { act, renderHook, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axiosMock, createTestQueryClient, Providers, sessionMock } from '@/test/frontend/render'
import { eventKeys, useEvents } from './event'

const event = {
  id: 'event-1',
  churchId: 'church-1',
  category: 'SERVICE',
  title: 'Sunday Mass',
  description: 'Weekly Mass',
  startsAt: '2026-10-04T08:00:00.000Z',
  location: 'Main Hall',
  registrationUrl: null,
  languageCode: 'en',
  version: 3,
  createdAt: '2026-09-01T00:00:00.000Z',
}

const createPayload = {
  category: 'SERVICE' as const,
  title: 'Sunday Mass',
  description: 'Weekly Mass',
  startsAt: '2026-10-04T08:00:00Z',
  location: 'Main Hall',
  registrationUrl: null,
  languageCode: 'en',
}

describe('Event data hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockReturnValue({
      data: { user: { user_id: 'user-1' } },
      status: 'authenticated',
    })
  })

  it('fetches with encoded filters and keeps every result-shaping value in its key', async () => {
    const client = createTestQueryClient()
    axiosMock.get.mockResolvedValueOnce({ data: { result: [event], total: 1 } })

    const { result } = renderHook(
      () =>
        useEvents({
          churchId: 'church-1',
          page: 2,
          limit: 10,
          search: ' Mass & prayer ',
          category: 'SERVICE',
          orderBy: 'title',
          orderDirection: 'desc',
        }),
      { wrapper: ({ children }) => <Providers client={client}>{children}</Providers> },
    )

    await waitFor(() => expect(result.current.data).toEqual([event]))
    expect(axiosMock.get).toHaveBeenCalledWith(
      '/api/v1/admin/churches/church-1/events?page=2&limit=10&order_by=title&order_direction=desc&search=Mass+%26+prayer&category=SERVICE',
    )
    expect(
      client.getQueryCache().find({
        queryKey: eventKeys.list('user-1', 'church-1', {
          page: 2,
          limit: 10,
          search: 'Mass & prayer',
          category: 'SERVICE',
          order_by: 'title',
          order_direction: 'desc',
        }),
      }),
    ).toBeDefined()
  })

  it('does not reuse results when the church changes', async () => {
    axiosMock.get
      .mockResolvedValueOnce({ data: { result: [event], total: 1 } })
      .mockResolvedValueOnce({
        data: { result: [{ ...event, id: 'event-2', churchId: 'church-2' }], total: 1 },
      })

    const { result, rerender } = renderHook(({ churchId }) => useEvents({ churchId }), {
      initialProps: { churchId: 'church-1' },
      wrapper: Providers,
    })
    await waitFor(() => expect(result.current.data?.[0].churchId).toBe('church-1'))

    rerender({ churchId: 'church-2' })
    await waitFor(() => expect(result.current.data?.[0].churchId).toBe('church-2'))

    expect(axiosMock.get).toHaveBeenNthCalledWith(
      2,
      '/api/v1/admin/churches/church-2/events?page=1&limit=25&order_by=starts_at&order_direction=asc',
    )
  })

  it('creates an event and invalidates only its church list family', async () => {
    const client = createTestQueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    axiosMock.get.mockResolvedValueOnce({ data: { result: [], total: 0 } })
    axiosMock.post.mockResolvedValueOnce({ data: { result: event } })

    const { result } = renderHook(() => useEvents({ churchId: 'church-1' }), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.onCreate(createPayload)
    })

    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/v1/admin/churches/church-1/events',
      createPayload,
    )
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: eventKeys.lists('user-1', 'church-1'),
    })
  })

  it('updates an event with the exact current version and invalidates its church lists', async () => {
    const client = createTestQueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    axiosMock.get.mockResolvedValueOnce({ data: { result: [event], total: 1 } })
    axiosMock.patch.mockResolvedValueOnce({ data: { result: { ...event, version: 4 } } })
    const payload = { ...createPayload, version: 3 }

    const { result } = renderHook(() => useEvents({ churchId: 'church-1' }), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    })
    await waitFor(() => expect(result.current.data).toEqual([event]))

    await act(async () => {
      await result.current.onUpdate({ eventId: 'event/1', payload })
    })

    expect(axiosMock.patch).toHaveBeenCalledWith(
      '/api/v1/admin/churches/church-1/events/event%2F1',
      payload,
    )
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: eventKeys.lists('user-1', 'church-1'),
    })
  })

  it('shows an actionable refresh message for stale versions', async () => {
    const errorNotification = vi.fn()
    const useApp = vi.spyOn(App, 'useApp').mockReturnValue({
      notification: { error: errorNotification, success: vi.fn() },
    } as unknown as ReturnType<typeof App.useApp>)
    axiosMock.get.mockResolvedValueOnce({ data: { result: [event], total: 1 } })
    const error = new Error('Conflict') as Error & { isAxiosError: boolean; response: unknown }
    error.isAxiosError = true
    error.response = {
      status: 409,
      data: { error_code: 'STALE_VERSION', details: 'This event has changed.' },
    }
    axiosMock.patch.mockRejectedValueOnce(error)

    const { result } = renderHook(() => useEvents({ churchId: 'church-1' }), {
      wrapper: Providers,
    })
    await waitFor(() => expect(result.current.data).toEqual([event]))

    await expect(
      result.current.onUpdate({
        eventId: 'event-1',
        payload: { ...createPayload, version: 3 },
      }),
    ).rejects.toThrow()
    expect(errorNotification).toHaveBeenCalledWith({
      title: 'Version Conflict',
      description: 'This event has changed. Refresh the event list and try again.',
    })
    useApp.mockRestore()
  })

  it('surfaces server validation details and field messages', async () => {
    const errorNotification = vi.fn()
    const useApp = vi.spyOn(App, 'useApp').mockReturnValue({
      notification: { error: errorNotification, success: vi.fn() },
    } as unknown as ReturnType<typeof App.useApp>)
    axiosMock.get.mockResolvedValueOnce({ data: { result: [], total: 0 } })
    const error = new Error('Invalid') as Error & { isAxiosError: boolean; response: unknown }
    error.isAxiosError = true
    error.response = {
      status: 422,
      data: {
        error_code: 'VALIDATION_ERROR',
        details: 'Event validation failed.',
        fields: {
          startsAt: 'Choose an existing local time.',
          registrationUrl: 'Use an HTTPS URL.',
          languageCode: 'Choose an enabled language.',
        },
      },
    }
    axiosMock.post.mockRejectedValueOnce(error)

    const { result } = renderHook(() => useEvents({ churchId: 'church-1' }), {
      wrapper: Providers,
    })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(result.current.onCreate(createPayload)).rejects.toThrow()
    expect(errorNotification).toHaveBeenCalledWith({
      title: 'Invalid Event Data',
      description:
        'Event validation failed. startsAt: Choose an existing local time. registrationUrl: Use an HTTPS URL. languageCode: Choose an enabled language.',
    })
    useApp.mockRestore()
  })
})
