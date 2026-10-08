import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axiosMock, Providers, resolveGet, sessionMock } from '@/test/frontend/render'
import { useDonations, useDonationSubscriptions, useDonationSummary } from './donation'
import { DonationRow, DonationSubscriptionRow, DonationSummary } from '@/models/donation'

const mockDonations: DonationRow[] = [
  { id: '1', amountMinor: '1000', currency: 'USD', paidAt: new Date(), ref: 'tx_1' },
  { id: '2', amountMinor: '2000', currency: 'USD', paidAt: new Date(), ref: 'tx_2' },
]

const mockSubscriptions: DonationSubscriptionRow[] = [
  {
    id: 's1',
    amountMinor: '5000',
    currency: 'USD',
    providerStatus: 'active',
    createdAt: new Date(),
  },
  {
    id: 's2',
    amountMinor: '2500',
    currency: 'EUR',
    providerStatus: 'past_due',
    createdAt: new Date(),
  },
]

const mockSummary: DonationSummary = {
  month: '2026-09',
  currencies: [
    { currency: 'USD', grossMinor: '10000', refundedMinor: '0', netMinor: '10000' },
    { currency: 'EUR', grossMinor: '5000', refundedMinor: '500', netMinor: '4500' },
  ],
}

describe('Donation Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    axiosMock.get.mockClear()
    sessionMock.mockReturnValue({ data: { user: { user_id: 'u1' } }, status: 'authenticated' })
  })

  describe('useDonations', () => {
    it('fetches list with default query params and returns data + total', async () => {
      axiosMock.get.mockResolvedValue({ data: resolveGet(mockDonations, 2) })

      const { result } = renderHook(() => useDonations({ churchId: 'c1' }), {
        wrapper: Providers,
      })
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.data).toEqual(mockDonations)
      expect(result.current.total).toBe(2)
      expect(axiosMock.get).toHaveBeenCalledWith(
        '/api/v1/admin/churches/c1/donations?page=1&limit=25&order_by=paid_at&order_direction=desc',
      )
    })

    it('appends custom params including from and to dates', async () => {
      axiosMock.get.mockResolvedValue({ data: resolveGet(mockDonations, 2) })

      const from = new Date('2026-01-01T00:00:00Z')
      const to = new Date('2026-12-31T23:59:59Z')

      const { result } = renderHook(
        () => useDonations({ churchId: 'c1', from, to, orderBy: 'amount', orderDirection: 'asc' }),
        { wrapper: Providers },
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(axiosMock.get).toHaveBeenCalledWith(
        `/api/v1/admin/churches/c1/donations?page=1&limit=25&order_by=amount&order_direction=asc&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      )
    })

    it('does not fetch when enableFetch is false', () => {
      renderHook(() => useDonations({ churchId: 'c1', enableFetch: false }), { wrapper: Providers })
      expect(axiosMock.get).not.toHaveBeenCalled()
    })

    it('does not fetch when churchId is empty', () => {
      renderHook(() => useDonations({ churchId: '' }), { wrapper: Providers })
      expect(axiosMock.get).not.toHaveBeenCalled()
    })

    it('returns empty array when backend returns undefined result', async () => {
      axiosMock.get.mockResolvedValue({ data: {} })

      const { result } = renderHook(() => useDonations({ churchId: 'c1' }), {
        wrapper: Providers,
      })
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.data).toEqual([])
      expect(result.current.total).toBe(0)
    })

    it('sets error on request failure', async () => {
      const error = new Error('Network error')
      axiosMock.get.mockRejectedValue(error)

      const { result } = renderHook(() => useDonations({ churchId: 'c1' }), {
        wrapper: Providers,
      })
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.error).toEqual(error)
      expect(result.current.data).toEqual([])
    })
  })

  describe('useDonationSubscriptions', () => {
    it('fetches recurring list with default query params and returns data + total', async () => {
      axiosMock.get.mockResolvedValue({ data: resolveGet(mockSubscriptions, 2) })

      const { result } = renderHook(() => useDonationSubscriptions({ churchId: 'c1' }), {
        wrapper: Providers,
      })
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.data).toEqual(mockSubscriptions)
      expect(result.current.total).toBe(2)
      expect(axiosMock.get).toHaveBeenCalledWith(
        '/api/v1/admin/churches/c1/donation-subscriptions?page=1&limit=25&order_by=created_at&order_direction=desc',
      )
    })

    it('does not fetch when enableFetch is false', () => {
      renderHook(() => useDonationSubscriptions({ churchId: 'c1', enableFetch: false }), {
        wrapper: Providers,
      })
      expect(axiosMock.get).not.toHaveBeenCalled()
    })

    it('does not fetch when churchId is empty', () => {
      renderHook(() => useDonationSubscriptions({ churchId: '' }), { wrapper: Providers })
      expect(axiosMock.get).not.toHaveBeenCalled()
    })
  })

  describe('useDonationSummary', () => {
    it('fetches monthly summary for specified month', async () => {
      axiosMock.get.mockResolvedValue({ data: { result: mockSummary } })

      const { result } = renderHook(
        () => useDonationSummary({ churchId: 'c1', month: '2026-09' }),
        {
          wrapper: Providers,
        },
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.data).toEqual(mockSummary)
      expect(axiosMock.get).toHaveBeenCalledWith(
        '/api/v1/admin/churches/c1/donation-summary?month=2026-09',
      )
    })

    it('does not fetch when enableFetch is false', () => {
      renderHook(
        () => useDonationSummary({ churchId: 'c1', month: '2026-09', enableFetch: false }),
        { wrapper: Providers },
      )
      expect(axiosMock.get).not.toHaveBeenCalled()
    })

    it('does not fetch when month is empty', () => {
      renderHook(() => useDonationSummary({ churchId: 'c1', month: '' }), { wrapper: Providers })
      expect(axiosMock.get).not.toHaveBeenCalled()
    })

    it('does not fetch when churchId is empty', () => {
      renderHook(() => useDonationSummary({ churchId: '', month: '2026-09' }), {
        wrapper: Providers,
      })
      expect(axiosMock.get).not.toHaveBeenCalled()
    })
  })
})
