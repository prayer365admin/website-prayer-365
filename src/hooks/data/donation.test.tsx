import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  axiosMock,
  createTestQueryClient,
  Providers,
  resolveGet,
  sessionMock,
} from '@/test/frontend/render'
import {
  useAdminDonationSummary,
  useAdminDonationSummaryMonthly,
  useAdminDonationSubscriptions,
  useAdminDonations,
  useDonations,
  useDonationSubscriptions,
  useDonationSummary,
} from './donation'
import {
  AdminDonationRow,
  DonationLedgerStatus,
  DonationRow,
  DonationSubscriptionRow,
  DonationSummary,
} from '@/models/donation'

const mockDonations: DonationRow[] = [
  {
    id: '1',
    amountMinor: '1000',
    currency: 'USD',
    status: 'PAID',
    paidAt: new Date(),
    ref: 'tx_1',
  },
  { id: '2', amountMinor: '2000', currency: 'USD', status: 'FAILED', paidAt: null, ref: 'tx_2' },
]

const mockAdminDonations: AdminDonationRow[] = [
  {
    id: '1',
    amountMinor: '1000',
    currency: 'EUR',
    status: 'PAID',
    paidAt: new Date(),
    ref: 'pi_1',
    churchId: 'p1',
    churchName: 'Prayer 365',
    type: 'PRAYER',
    refundedMinor: '0',
    donor: null,
    invoiceUrl: null,
  },
]

const mockSubscriptions: DonationSubscriptionRow[] = [
  {
    id: 's1',
    amountMinor: '5000',
    currency: 'USD',
    providerStatus: 'active',
    createdAt: new Date(),
    churchId: 'c1',
    churchName: 'Hope Church',
    frequency: 'Monthly',
    invoiceUrl: null,
  },
  {
    id: 's2',
    amountMinor: '2500',
    currency: 'EUR',
    providerStatus: 'past_due',
    createdAt: new Date(),
    churchId: 'c1',
    churchName: 'Hope Church',
    frequency: 'Monthly',
    invoiceUrl: null,
  },
]

const mockSummary: DonationSummary = {
  month: '2026-09',
  currencies: [
    { currency: 'USD', grossMinor: '10000', refundedMinor: '0', netMinor: '10000', count: 2 },
    { currency: 'EUR', grossMinor: '5000', refundedMinor: '500', netMinor: '4500', count: 1 },
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

  describe('useDonations status filter', () => {
    it('sends the ledger status and keeps the per-church URL', async () => {
      axiosMock.get.mockResolvedValue({ data: resolveGet(mockDonations, 2) })

      const { result } = renderHook(() => useDonations({ churchId: 'c1', status: 'REFUNDED' }), {
        wrapper: Providers,
      })
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(axiosMock.get).toHaveBeenCalledWith(
        '/api/v1/admin/churches/c1/donations?page=1&limit=25&order_by=paid_at&order_direction=desc&status=REFUNDED',
      )
    })

    it('keys the list by status, so changing it is a new read', async () => {
      axiosMock.get.mockResolvedValue({ data: resolveGet(mockDonations, 2) })
      const client = createTestQueryClient()
      const { rerender } = renderHook(
        ({ status }: { status?: DonationLedgerStatus }) => useDonations({ churchId: 'c1', status }),
        {
          wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
          initialProps: {} as { status?: DonationLedgerStatus },
        },
      )
      await waitFor(() => expect(axiosMock.get).toHaveBeenCalledTimes(1))

      rerender({ status: 'FAILED' })

      await waitFor(() =>
        expect(
          client.getQueryCache().findAll({ queryKey: ['donations', 'transactions', 'u1', 'c1'] }),
        ).toHaveLength(2),
      )
      expect(axiosMock.get.mock.calls[1]![0]).toContain('status=FAILED')
    })
  })

  describe('useAdminDonations', () => {
    it('reads the all-church list without a church path segment', async () => {
      axiosMock.get.mockResolvedValue({ data: resolveGet(mockAdminDonations, 1) })

      const { result } = renderHook(() => useAdminDonations({ status: 'FAILED', churchId: 'c1' }), {
        wrapper: Providers,
      })
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(axiosMock.get).toHaveBeenCalledWith(
        '/api/v1/admin/donations?page=1&limit=25&order_by=paid_at&order_direction=desc&status=FAILED&churchId=c1',
      )
      expect(result.current.total).toBe(1)
      expect(result.current.data).toEqual(mockAdminDonations)
    })

    it('does not fetch when enableFetch is false', () => {
      renderHook(() => useAdminDonations({ enableFetch: false }), { wrapper: Providers })
      expect(axiosMock.get).not.toHaveBeenCalled()
    })
  })

  describe('useAdminDonationSummary', () => {
    it('reads the three-bucket summary for the range', async () => {
      const summary = {
        from: new Date('2026-11-01T00:00:00Z'),
        to: new Date('2026-11-30T23:59:59.999Z'),
        currencies: [],
      }
      axiosMock.get.mockResolvedValue({ data: { result: summary } })

      const { result } = renderHook(
        () =>
          useAdminDonationSummary({
            from: new Date('2026-11-01T00:00:00Z'),
            to: new Date('2026-11-30T23:59:59.999Z'),
            churchId: 'p1',
          }),
        { wrapper: Providers },
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.data).toEqual(summary)
      expect(axiosMock.get).toHaveBeenCalledWith(
        `/api/v1/admin/donations/summary?from=${encodeURIComponent(
          '2026-11-01T00:00:00.000Z',
        )}&to=${encodeURIComponent('2026-11-30T23:59:59.999Z')}&churchId=p1`,
      )
    })

    it('never sends a status filter (cards stay PAID-based, T-05)', async () => {
      axiosMock.get.mockResolvedValue({
        data: { result: { from: new Date(), to: new Date(), currencies: [] } },
      })

      const { result } = renderHook(() => useAdminDonationSummary({}), { wrapper: Providers })
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/admin/donations/summary')
    })

    it('does not fetch when enableFetch is false', () => {
      renderHook(() => useAdminDonationSummary({ enableFetch: false }), { wrapper: Providers })
      expect(axiosMock.get).not.toHaveBeenCalled()
    })
  })

  describe('useAdminDonationSubscriptions', () => {
    it('reads the all-church recurring list', async () => {
      axiosMock.get.mockResolvedValue({ data: resolveGet(mockSubscriptions, 1) })

      const { result } = renderHook(
        () => useAdminDonationSubscriptions({ currency: 'eur', churchId: 'c1' }),
        { wrapper: Providers },
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(axiosMock.get).toHaveBeenCalledWith(
        '/api/v1/admin/donations/recurring?page=1&limit=25&order_by=created_at&order_direction=desc&currency=eur&churchId=c1',
      )
      expect(result.current.total).toBe(1)
      expect(result.current.data).toEqual(mockSubscriptions)
    })

    it('does not fetch when enableFetch is false', () => {
      renderHook(() => useAdminDonationSubscriptions({ enableFetch: false }), {
        wrapper: Providers,
      })
      expect(axiosMock.get).not.toHaveBeenCalled()
    })
  })

  describe('useAdminDonationSummaryMonthly', () => {
    it('reads monthly rows for the range and church', async () => {
      const monthly = [
        {
          month: '2026-11',
          currency: 'eur',
          grossMinor: '1500',
          refundedMinor: '0',
          netMinor: '1500',
          count: 2,
        },
      ]
      axiosMock.get.mockResolvedValue({ data: { result: monthly } })

      const { result } = renderHook(
        () =>
          useAdminDonationSummaryMonthly({
            from: new Date('2026-01-01T00:00:00Z'),
            to: new Date('2026-11-30T23:59:59.999Z'),
            churchId: 'c1',
          }),
        { wrapper: Providers },
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.data).toEqual(monthly)
      expect(axiosMock.get).toHaveBeenCalledWith(
        `/api/v1/admin/donations/summary/monthly?from=${encodeURIComponent(
          '2026-01-01T00:00:00.000Z',
        )}&to=${encodeURIComponent('2026-11-30T23:59:59.999Z')}&churchId=c1`,
      )
    })

    it('does not fetch when enableFetch is false', () => {
      renderHook(() => useAdminDonationSummaryMonthly({ enableFetch: false }), {
        wrapper: Providers,
      })
      expect(axiosMock.get).not.toHaveBeenCalled()
    })
  })
})
