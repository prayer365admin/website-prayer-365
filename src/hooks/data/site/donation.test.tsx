import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axiosMock } from '@/test/frontend/render'
import { useDonationStatus, useInitiateDonation } from './donation'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

beforeEach(() => vi.clearAllMocks())

describe('useInitiateDonation', () => {
  it('posts the shared contract with one Idempotency-Key and returns the session', async () => {
    axiosMock.post.mockResolvedValue({
      data: { result: { sessionId: 'cs_1', url: 'https://checkout.test/cs_1' } },
    })
    const { result } = renderHook(() => useInitiateDonation(), { wrapper })

    const started = await result.current.onInitiate({
      churchId: 'c1',
      input: { amountMinor: 2500, currency: 'eur', frequency: 'one_time' },
    })

    expect(started).toEqual({ sessionId: 'cs_1', url: 'https://checkout.test/cs_1' })
    const [url, body, config] = axiosMock.post.mock.calls[0]
    expect(url).toBe('/api/v1/site/donations')
    expect(body).toEqual({
      churchId: 'c1',
      amountMinor: 2500,
      currency: 'eur',
      frequency: 'one_time',
    })
    expect(config.headers['Idempotency-Key']).toEqual(expect.any(String))
  })

  it('never builds the endpoint from the church id', async () => {
    axiosMock.post.mockResolvedValue({ data: { result: { sessionId: 'cs_2', url: 'u' } } })
    const { result } = renderHook(() => useInitiateDonation(), { wrapper })

    await result.current.onInitiate({
      churchId: '../../admin',
      input: { amountMinor: 1000, currency: 'eur', frequency: 'one_time' },
    })

    // The server rejects an unusable id; the client never turns it into a URL.
    expect(axiosMock.post.mock.calls[0][0]).toBe('/api/v1/site/donations')
  })
})

describe('useDonationStatus', () => {
  const attempt = {
    sessionId: 'cs_1',
    churchId: 'c1',
    amountMinor: 1000,
    currency: 'eur',
    frequency: 'one_time' as const,
  }

  it('does not query without a complete attempt', () => {
    const { result } = renderHook(
      () => useDonationStatus({ attempt: { ...attempt, sessionId: null }, enabled: true }),
      { wrapper },
    )

    expect(result.current.status).toBeNull()
    expect(axiosMock.get).not.toHaveBeenCalled()
  })

  it('reads the giver-scoped status for a complete attempt', async () => {
    axiosMock.get.mockResolvedValue({
      data: { result: { state: 'pending', churchId: 'c1', churchName: 'X' } },
    })

    const { result } = renderHook(() => useDonationStatus({ attempt, enabled: true }), { wrapper })

    await waitFor(() => expect(result.current.status).not.toBeNull())
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/donations/status', {
      params: expect.objectContaining({ sessionId: 'cs_1', churchId: 'c1', amountMinor: 1000 }),
    })
    expect(result.current.status?.state).toBe('pending')
  })
})
