import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axiosMock, createTestQueryClient, Providers, sessionMock } from '@/test/frontend/render'
import { requestKeys, useRequest, useRequests } from './request'

const summary = {
  id: 'request-1',
  kind: 'prayer',
  subject: 'Prayer for family',
  classification: 'standard',
  contactMethod: 'email',
  createdAt: '2026-10-01T00:00:00.000Z',
}

const detail = {
  ...summary,
  message: 'Please pray for us.',
  phone: null,
  email: 'member@example.org',
  availability: null,
}

const axiosError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status } })

describe('Request data hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockReturnValue({
      data: { user: { user_id: 'user-1' } },
      status: 'authenticated',
    })
  })

  it('fetches a comma kind list with paging and scopes the cache by user and church', async () => {
    const client = createTestQueryClient()
    axiosMock.get.mockResolvedValueOnce({ data: { result: [summary], total: 1 } })

    const { result } = renderHook(
      () =>
        useRequests({
          churchId: 'church 1',
          kinds: ['pastoral', 'meeting'],
          page: 2,
          limit: 10,
          orderDirection: 'asc',
        }),
      { wrapper: ({ children }) => <Providers client={client}>{children}</Providers> },
    )

    await waitFor(() => expect(result.current.data).toEqual([summary]))
    expect(result.current.total).toBe(1)
    expect(axiosMock.get).toHaveBeenCalledWith(
      '/api/v1/admin/churches/church%201/requests?page=2&limit=10&order_by=created_at&order_direction=asc&kind=pastoral%2Cmeeting',
    )
    expect(
      client.getQueryCache().find({
        queryKey: requestKeys.list('user-1', 'church 1', {
          kinds: ['pastoral', 'meeting'],
          page: 2,
          limit: 10,
          orderDirection: 'asc',
        }),
      }),
    ).toBeDefined()
  })

  it('sends trimmed search, classification and received range', async () => {
    const client = createTestQueryClient()
    axiosMock.get.mockResolvedValueOnce({ data: { result: [], total: 0 } })

    const { result } = renderHook(
      () =>
        useRequests({
          churchId: 'church-1',
          kinds: ['prayer'],
          search: '  family & friends ',
          classification: 'private',
          receivedFrom: '2026-10-01T00:00:00.000Z',
          receivedTo: '2026-10-31T23:59:59.999Z',
        }),
      { wrapper: ({ children }) => <Providers client={client}>{children}</Providers> },
    )

    await waitFor(() => expect(result.current.data).toEqual([]))
    expect(axiosMock.get).toHaveBeenCalledWith(
      '/api/v1/admin/churches/church-1/requests?page=1&limit=25&order_by=created_at&order_direction=desc&kind=prayer&search=family+%26+friends&classification=private&received_from=2026-10-01T00%3A00%3A00.000Z&received_to=2026-10-31T23%3A59%3A59.999Z',
    )
  })

  it('omits the kind param when no kinds are given', async () => {
    const client = createTestQueryClient()
    axiosMock.get.mockResolvedValueOnce({ data: { result: [], total: 0 } })

    const { result } = renderHook(() => useRequests({ churchId: 'church-1' }), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    })

    await waitFor(() => expect(result.current.data).toEqual([]))
    expect(axiosMock.get).toHaveBeenCalledWith(
      '/api/v1/admin/churches/church-1/requests?page=1&limit=25&order_by=created_at&order_direction=desc',
    )
  })

  it('does not reuse cached requests when the church or user changes', async () => {
    let userId = 'user-1'
    sessionMock.mockImplementation(() => ({
      data: { user: { user_id: userId } },
      status: 'authenticated',
    }))
    axiosMock.get
      .mockResolvedValueOnce({ data: { result: [summary], total: 1 } })
      .mockResolvedValueOnce({ data: { result: [{ ...summary, id: 'request-2' }], total: 1 } })
      .mockResolvedValueOnce({ data: { result: [{ ...summary, id: 'request-3' }], total: 1 } })
    const client = createTestQueryClient()

    const { result, rerender } = renderHook(
      ({ churchId }: { churchId: string }) => useRequests({ churchId }),
      {
        initialProps: { churchId: 'church-1' },
        wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
      },
    )
    await waitFor(() => expect(result.current.data?.[0].id).toBe('request-1'))

    rerender({ churchId: 'church-2' })
    await waitFor(() => expect(result.current.data?.[0].id).toBe('request-2'))

    userId = 'user-2'
    rerender({ churchId: 'church-2' })
    await waitFor(() => expect(result.current.data?.[0].id).toBe('request-3'))
    expect(axiosMock.get).toHaveBeenCalledTimes(3)
  })

  it('reports a list 404 as notFound without retrying', async () => {
    axiosMock.get.mockRejectedValue(axiosError(404))
    const client = createTestQueryClient()

    const { result } = renderHook(() => useRequests({ churchId: 'church-1' }), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    })

    await waitFor(() => expect(result.current.notFound).toBe(true))
    expect(result.current.data).toBeUndefined()
    expect(axiosMock.get).toHaveBeenCalledTimes(1)
  })

  it('fetches an encoded request detail under a user and church scoped key', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: { result: detail } })
    const client = createTestQueryClient()

    const { result } = renderHook(
      () => useRequest({ churchId: 'church-1', requestId: 'request/1' }),
      { wrapper: ({ children }) => <Providers client={client}>{children}</Providers> },
    )

    await waitFor(() => expect(result.current.data).toEqual(detail))
    expect(axiosMock.get).toHaveBeenCalledWith(
      '/api/v1/admin/churches/church-1/requests/request%2F1',
    )
    expect(
      client.getQueryCache().find({
        queryKey: requestKeys.detail('user-1', 'church-1', 'request/1'),
      }),
    ).toBeDefined()
  })

  it('reports a detail 404 as notFound without retrying', async () => {
    axiosMock.get.mockRejectedValue(axiosError(404))
    const client = createTestQueryClient()

    const { result } = renderHook(() => useRequest({ churchId: 'church-1', requestId: 'hidden' }), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    })

    await waitFor(() => expect(result.current.notFound).toBe(true))
    expect(result.current.data).toBeUndefined()
    expect(axiosMock.get).toHaveBeenCalledTimes(1)
  })

  it('does not fetch a detail without a request id', () => {
    const client = createTestQueryClient()
    renderHook(() => useRequest({ churchId: 'church-1', requestId: '' }), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    })
    expect(axiosMock.get).not.toHaveBeenCalled()
  })
})
