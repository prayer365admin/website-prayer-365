import { act, renderHook, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axiosMock, createTestQueryClient, Providers, sessionMock } from '@/test/frontend/render'
import { announcementKeys, useAnnouncementActions, useAnnouncements } from './announcement'

const announcement = {
  id: 'announcement-1',
  churchId: 'church-1',
  title: 'Parish news',
  body: 'Community lunch after Mass.',
  publishedAt: null,
  version: 3,
  createdAt: '2026-10-01T00:00:00.000Z',
}

describe('Announcement data hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockReturnValue({
      data: { user: { user_id: 'user-1' } },
      status: 'authenticated',
    })
  })

  it('fetches encoded filters and scopes the cache by user and church', async () => {
    const client = createTestQueryClient()
    axiosMock.get.mockResolvedValueOnce({ data: { result: [announcement], total: 1 } })

    const { result } = renderHook(
      () =>
        useAnnouncements({
          churchId: 'church-1',
          page: 2,
          limit: 10,
          search: ' lunch & Mass ',
          status: 'published',
          publishedFrom: '2026-10-01T00:00:00.000Z',
          publishedTo: '2026-10-31T23:59:59.000Z',
          orderBy: 'title',
          orderDirection: 'asc',
        }),
      { wrapper: ({ children }) => <Providers client={client}>{children}</Providers> },
    )

    await waitFor(() => expect(result.current.data).toEqual([announcement]))
    expect(axiosMock.get).toHaveBeenCalledWith(
      '/api/v1/admin/churches/church-1/announcements?page=2&limit=10&order_by=title&order_direction=asc&search=lunch+%26+Mass&status=published&published_from=2026-10-01T00%3A00%3A00.000Z&published_to=2026-10-31T23%3A59%3A59.000Z',
    )
    expect(
      client.getQueryCache().find({
        queryKey: announcementKeys.list('user-1', 'church-1', {
          page: 2,
          limit: 10,
          search: 'lunch & Mass',
          status: 'published',
          published_from: '2026-10-01T00:00:00.000Z',
          published_to: '2026-10-31T23:59:59.000Z',
          order_by: 'title',
          order_direction: 'asc',
        }),
      }),
    ).toBeDefined()
  })

  it('does not reuse results when the church or authenticated user changes', async () => {
    let userId = 'user-1'
    sessionMock.mockImplementation(() => ({
      data: { user: { user_id: userId } },
      status: 'authenticated',
    }))
    axiosMock.get
      .mockResolvedValueOnce({ data: { result: [announcement], total: 1 } })
      .mockResolvedValueOnce({
        data: {
          result: [{ ...announcement, id: 'announcement-2', churchId: 'church-2' }],
          total: 1,
        },
      })
      .mockResolvedValueOnce({
        data: {
          result: [{ ...announcement, id: 'announcement-3', churchId: 'church-2' }],
          total: 1,
        },
      })

    const { result, rerender } = renderHook(({ churchId }) => useAnnouncements({ churchId }), {
      initialProps: { churchId: 'church-1' },
      wrapper: Providers,
    })
    await waitFor(() => expect(result.current.data?.[0].id).toBe('announcement-1'))

    rerender({ churchId: 'church-2' })
    await waitFor(() => expect(result.current.data?.[0].id).toBe('announcement-2'))

    userId = 'user-2'
    rerender({ churchId: 'church-2' })
    await waitFor(() => expect(result.current.data?.[0].id).toBe('announcement-3'))

    expect(axiosMock.get).toHaveBeenCalledTimes(3)
  })

  it('creates a draft and invalidates its church list family and central lists', async () => {
    const client = createTestQueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    axiosMock.get.mockResolvedValueOnce({ data: { result: [], total: 0 } })
    axiosMock.post.mockResolvedValueOnce({ data: { result: announcement } })

    const { result } = renderHook(() => useAnnouncements({ churchId: 'church-1' }), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.onCreate({ title: 'Parish news', body: 'Lunch' })
    })

    expect(axiosMock.post).toHaveBeenCalledWith('/api/v1/admin/churches/church-1/announcements', {
      title: 'Parish news',
      body: 'Lunch',
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: announcementKeys.lists('user-1', 'church-1'),
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: announcementKeys.central('user-1') })
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: announcementKeys.lists('user-1', 'church-2'),
    })
  })

  it('updates, publishes, and unpublishes using the exact current version', async () => {
    const client = createTestQueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    axiosMock.patch.mockResolvedValueOnce({
      data: { result: { ...announcement, version: 4 } },
    })
    axiosMock.post.mockResolvedValueOnce({
      data: {
        result: {
          ...announcement,
          version: 5,
          publishedAt: '2026-10-06T00:00:00.000Z',
        },
      },
    })
    axiosMock.post.mockResolvedValueOnce({
      data: { result: { ...announcement, version: 6, publishedAt: null } },
    })

    const { result } = renderHook(
      () => useAnnouncements({ churchId: 'church-1', enableFetch: false }),
      { wrapper: ({ children }) => <Providers client={client}>{children}</Providers> },
    )

    await act(async () => {
      await result.current.onUpdate({
        announcementId: 'announcement/1',
        payload: { title: 'Updated', body: 'Body', version: 3 },
      })
      await result.current.onPublish({ announcementId: 'announcement/1', version: 4 })
      await result.current.onUnpublish({ announcementId: 'announcement/1', version: 5 })
    })

    expect(axiosMock.patch).toHaveBeenCalledWith(
      '/api/v1/admin/churches/church-1/announcements/announcement%2F1',
      { title: 'Updated', body: 'Body', version: 3 },
    )
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/v1/admin/churches/church-1/announcements/announcement%2F1/publish',
      { version: 4 },
    )
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/v1/admin/churches/church-1/announcements/announcement%2F1/unpublish',
      { version: 5 },
    )
    for (const call of [1, 3, 5]) {
      expect(invalidate).toHaveBeenNthCalledWith(call, {
        queryKey: announcementKeys.lists('user-1', 'church-1'),
      })
      expect(invalidate).toHaveBeenNthCalledWith(call + 1, {
        queryKey: announcementKeys.central('user-1'),
      })
    }
  })

  it('shows an actionable refresh message for a stale publish', async () => {
    const errorNotification = vi.fn()
    const useApp = vi.spyOn(App, 'useApp').mockReturnValue({
      notification: { error: errorNotification, success: vi.fn() },
    } as unknown as ReturnType<typeof App.useApp>)
    axiosMock.get.mockResolvedValueOnce({ data: { result: [announcement], total: 1 } })
    const error = new Error('Conflict') as Error & { isAxiosError: boolean; response: unknown }
    error.isAxiosError = true
    error.response = {
      status: 409,
      data: {
        error_code: 'STALE_VERSION',
        details: 'This announcement has changed.',
      },
    }
    axiosMock.post.mockRejectedValueOnce(error)

    const { result } = renderHook(() => useAnnouncements({ churchId: 'church-1' }), {
      wrapper: Providers,
    })
    await waitFor(() => expect(result.current.data).toEqual([announcement]))

    await expect(
      result.current.onPublish({ announcementId: 'announcement-1', version: 3 }),
    ).rejects.toThrow()
    expect(errorNotification).toHaveBeenCalledWith({
      title: 'Version Conflict',
      description: 'This announcement has changed. Refresh the announcement list and try again.',
    })
    useApp.mockRestore()
  })

  it('surfaces server validation details and field messages', async () => {
    const errorNotification = vi.fn()
    const useApp = vi.spyOn(App, 'useApp').mockReturnValue({
      notification: { error: errorNotification, success: vi.fn() },
    } as unknown as ReturnType<typeof App.useApp>)
    const error = new Error('Invalid') as Error & { isAxiosError: boolean; response: unknown }
    error.isAxiosError = true
    error.response = {
      status: 422,
      data: {
        error_code: 'VALIDATION_ERROR',
        details: 'Announcement validation failed.',
        fields: {
          title: 'Use 500 characters or fewer.',
          body: 'Enter an announcement message.',
        },
      },
    }
    axiosMock.post.mockRejectedValueOnce(error)

    const { result } = renderHook(
      () => useAnnouncements({ churchId: 'church-1', enableFetch: false }),
      { wrapper: Providers },
    )

    await expect(result.current.onCreate({ title: 'Too long', body: '' })).rejects.toThrow()
    expect(errorNotification).toHaveBeenCalledWith({
      title: 'Invalid Announcement',
      description:
        'Announcement validation failed. title: Use 500 characters or fewer. body: Enter an announcement message.',
    })
    useApp.mockRestore()
  })

  it('acts on any church passed per call', async () => {
    axiosMock.post.mockResolvedValueOnce({ data: { result: announcement } })
    const { result } = renderHook(() => useAnnouncementActions(), { wrapper: Providers })

    await act(async () => {
      await result.current.onPublish({ churchId: 'church-2', announcementId: 'a1', version: 2 })
    })

    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/v1/admin/churches/church-2/announcements/a1/publish',
      { version: 2 },
    )
  })

  it('soft-deletes with the current version and refreshes lists', async () => {
    const client = createTestQueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    axiosMock.delete.mockResolvedValueOnce({ data: { result: null } })
    const { result } = renderHook(
      () => useAnnouncements({ churchId: 'church-1', enableFetch: false }),
      { wrapper: ({ children }) => <Providers client={client}>{children}</Providers> },
    )

    await act(async () => {
      await result.current.onDelete({ announcementId: 'a1', version: 7 })
    })

    expect(axiosMock.delete).toHaveBeenCalledWith(
      '/api/v1/admin/churches/church-1/announcements/a1',
      { data: { version: 7 } },
    )
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: announcementKeys.lists('user-1', 'church-1'),
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: announcementKeys.central('user-1') })
  })
})
