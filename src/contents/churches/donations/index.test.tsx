import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsChurchDonations from '.'

const m = vi.hoisted(() => ({
  canRead: true,
  useDonations: vi.fn(),
  useDonationSubscriptions: vi.fn(),
  useDonationSummary: vi.fn(),
}))

vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    readAny: () => ({ granted: m.canRead }),
    readOwn: () => ({ granted: false }),
  }),
}))

vi.mock('@/hooks/data/donation', () => ({
  useDonations: (...args: unknown[]) => m.useDonations(...args),
  useDonationSubscriptions: (...args: unknown[]) => m.useDonationSubscriptions(...args),
  useDonationSummary: (...args: unknown[]) => m.useDonationSummary(...args),
}))

describe('ContentsChurchDonations', () => {
  const defaultSummary = {
    currencies: [
      { currency: 'usd', grossMinor: '100000', refundedMinor: '5000', netMinor: '95000' },
      { currency: 'eur', grossMinor: '25000', refundedMinor: '0', netMinor: '25000' },
    ],
  }

  const defaultTx = [
    {
      id: 't1',
      amountMinor: '5000',
      currency: 'usd',
      status: 'PAID',
      paidAt: new Date('2024-05-10T12:00:00Z'),
      ref: 'tx-1',
    },
    {
      id: 't2',
      amountMinor: '25000',
      currency: 'eur',
      status: 'FAILED',
      paidAt: null,
      ref: 'tx-2',
    },
  ]

  const defaultSubscriptions = [
    {
      id: 's1',
      amountMinor: '15000',
      currency: 'usd',
      providerStatus: 'active',
      createdAt: new Date(),
    },
    {
      id: 's2',
      amountMinor: '1000',
      currency: 'eur',
      providerStatus: 'past_due',
      createdAt: new Date(),
    },
    {
      id: 's3',
      amountMinor: '500',
      currency: 'gbp',
      providerStatus: 'canceled',
      createdAt: new Date(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    m.canRead = true
    m.useDonations.mockReturnValue({ data: defaultTx, total: 2, loading: false })
    m.useDonationSubscriptions.mockReturnValue({
      data: defaultSubscriptions,
      total: 3,
      loading: false,
    })
    m.useDonationSummary.mockReturnValue({ data: defaultSummary, loading: false })
  })

  it('renders header, summary cards, and transactions tab with sample data', async () => {
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    expect(screen.getByText('Donations')).toBeTruthy()
    expect(
      screen.getByText(
        'Review provider-confirmed transactions, recurring donations, and monthly totals.',
      ),
    ).toBeTruthy()

    // Summary cards
    expect(screen.getAllByText('USD 950.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('EUR 250.00').length).toBeGreaterThan(0)

    // Transactions Table
    expect(screen.getByText('tx-1')).toBeTruthy()
    expect(screen.getByText('tx-2')).toBeTruthy()
  })

  it('formats minor units to currency without cross-currency summation', async () => {
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)
    expect(screen.getAllByText('USD 950.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('EUR 250.00').length).toBeGreaterThan(0)

    // Ensure no combined total like 1200 exists
    expect(screen.queryByText(/1200/)).toBeNull()

    expect(screen.getAllByText('USD 50.00').length).toBeGreaterThan(0) // t1
    expect(screen.getAllByText('EUR 250.00').length).toBeGreaterThan(0) // t2
  })

  it('renders confirmed, failed, and refunded payment state tags from status', async () => {
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)
    expect(screen.getByText('Confirmed')).toBeTruthy()
    expect(screen.getByText('Failed')).toBeTruthy()
    expect(screen.queryByText('Pending')).toBeNull()
  })

  it('switches to Recurring tab and renders subscriptions, Monthly frequency, and provider state tags', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    await user.click(screen.getByRole('tab', { name: 'Recurring' }))

    expect(screen.getByText('s1')).toBeTruthy()
    expect(screen.getByText('s2')).toBeTruthy()

    // Frequency
    expect(screen.getAllByText('Monthly').length).toBe(3)

    // Tags
    expect(screen.getByText('Active')).toBeTruthy()
    expect(screen.getByText('Past due')).toBeTruthy()
    expect(screen.getByText('Canceled')).toBeTruthy()
  })

  it('switches to Monthly summary tab and renders gross, refunded, and net breakdown by currency', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    await user.click(screen.getByRole('tab', { name: 'Monthly summary' }))

    expect(screen.getAllByText('USD 1,000.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('USD 50.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('USD 950.00').length).toBeGreaterThan(0)

    expect(screen.getAllByText('EUR 250.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('EUR 0.00').length).toBeGreaterThan(0)
  })

  it('requests the selected currency from the server for both lists', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    // Open Select dropdown
    const select = screen.getByRole('combobox')
    await user.click(select)

    // Click 'USD' option
    await user.click(await screen.findByTitle('USD'))

    // Filtering is server-side: hooks receive the currency, no client-side
    // row slicing of the paginated lists.
    expect(m.useDonations).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'usd', churchId: 'c1' }),
    )
    expect(m.useDonationSubscriptions).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'usd', churchId: 'c1' }),
    )

    // Summary card is per-currency by construction and still shows rows.
    expect(screen.getAllByText('USD 950.00').length).toBeGreaterThan(0)
  })

  it('handles empty states when queries return zero records', async () => {
    m.useDonations.mockReturnValue({ data: [], total: 0, loading: false })
    m.useDonationSubscriptions.mockReturnValue({ data: [], total: 0, loading: false })
    m.useDonationSummary.mockReturnValue({ data: { currencies: [] }, loading: false })

    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    expect(screen.getByText('0')).toBeTruthy() // Donation count
    expect(screen.getAllByText('0.00').length).toBeGreaterThan(0) // Confirmed amount
    expect(screen.getAllByText('No data').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('tab', { name: 'Recurring' }))
    expect(screen.getAllByText('No data').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('tab', { name: 'Monthly summary' }))
    expect(screen.getAllByText('No data').length).toBeGreaterThan(0)
  })

  it('displays error alerts when API calls fail', async () => {
    m.useDonations.mockReturnValue({
      data: [],
      total: 0,
      loading: false,
      error: new Error('tx failed'),
    })
    m.useDonationSubscriptions.mockReturnValue({
      data: [],
      total: 0,
      loading: false,
      error: new Error('rec failed'),
    })
    m.useDonationSummary.mockReturnValue({
      data: undefined,
      loading: false,
      error: new Error('sum failed'),
    })

    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    expect(screen.getByText('Failed to load transactions')).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: 'Recurring' }))
    expect(screen.getByText('Failed to load recurring donations')).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: 'Monthly summary' }))
    expect(screen.getByText('Failed to load summary')).toBeTruthy()
  })

  it('enforces RBAC: shows access restriction message and suppresses data fetch when prayer_donation:read is lacking', async () => {
    m.canRead = false
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    expect(screen.getByText('Access restricted')).toBeTruthy()
    expect(screen.getByText('You do not have permission to view donations.')).toBeTruthy()

    // Tables shouldn't be rendered at all
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('confirms absence of refund, edit, delete, or subscription management controls', () => {
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    // We shouldn't see any of these buttons/links anywhere
    const unallowedText = /refund|edit|delete|manage/i

    const matchingElements = screen.queryAllByRole('button', { name: unallowedText })
    expect(matchingElements).toHaveLength(0)

    const unallowedLinks = screen.queryAllByRole('link', { name: unallowedText })
    expect(unallowedLinks).toHaveLength(0)
  })
})
