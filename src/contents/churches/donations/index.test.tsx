import { renderWithProviders } from '@/test/frontend/render'
import { screen, within } from '@testing-library/react'
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
      {
        currency: 'usd',
        grossMinor: '100000',
        refundedMinor: '5000',
        netMinor: '95000',
        count: 2,
      },
      { currency: 'eur', grossMinor: '25000', refundedMinor: '0', netMinor: '25000', count: 1 },
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
      donor: { name: 'Mari', email: 'mari@example.com' },
      invoiceUrl: 'https://pay.stripe.test/receipt/abc',
    },
    {
      id: 't2',
      amountMinor: '25000',
      currency: 'eur',
      status: 'FAILED',
      paidAt: null,
      ref: 'tx-2',
      donor: null,
      invoiceUrl: null,
    },
  ]

  const defaultSubscriptions = [
    {
      id: 's1',
      amountMinor: '15000',
      currency: 'usd',
      providerStatus: 'active',
      createdAt: new Date(),
      churchId: 'c1',
      churchName: 'Hope Church',
      frequency: 'Monthly',
      invoiceUrl: 'https://pay.stripe.test/receipt/sub1',
    },
    {
      id: 's2',
      amountMinor: '1000',
      currency: 'eur',
      providerStatus: 'past_due',
      createdAt: new Date(),
      churchId: 'c1',
      churchName: 'Hope Church',
      frequency: 'Monthly',
      invoiceUrl: 'https://pay.stripe.test/receipt/sub1',
    },
    {
      id: 's3',
      amountMinor: '500',
      currency: 'gbp',
      providerStatus: 'canceled',
      createdAt: new Date(),
      churchId: 'c1',
      churchName: 'Hope Church',
      frequency: 'Monthly',
      invoiceUrl: 'https://pay.stripe.test/receipt/sub1',
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

  it('renders header, the two stat cards with badges, and the transactions table', () => {
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    expect(screen.getByText('Donations')).toBeTruthy()
    expect(
      screen.getByText(
        'Review provider-confirmed transactions, recurring donations, and monthly totals.',
      ),
    ).toBeTruthy()

    expect(screen.getByText('Confirmed donations amount')).toBeTruthy()
    expect(screen.getByText('Donation Count')).toBeTruthy()
    expect(screen.getByText('950')).toBeTruthy()
    expect(screen.getByText('250')).toBeTruthy()
    expect(screen.getAllByText('US Dollar (2)').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Euro (1)').length).toBeGreaterThan(0)

    expect(screen.getByText('#T1')).toBeTruthy()
    expect(screen.getByText('#T2')).toBeTruthy()
    expect(screen.getByText('mari@example.com')).toBeTruthy()
    expect(screen.getAllByText('Guest').length).toBeGreaterThan(0)
  })

  it('formats minor units per row without crossing currencies', () => {
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    expect(screen.getByText(/USD 50/)).toBeTruthy()
    expect(screen.getByText(/€ 250/)).toBeTruthy()
    // No combined cross-currency total exists.
    expect(screen.queryByText(/1200/)).toBeNull()
  })

  it('renders the dot-pill payment states from status', () => {
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    expect(screen.getByText('Paid')).toBeTruthy()
    expect(screen.getByText('Failed')).toBeTruthy()
    expect(screen.queryByText('Pending')).toBeNull()
  })

  it('switches to the Recurring tab and renders plans with Monthly frequency and provider pills', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    expect(m.useDonationSubscriptions).toHaveBeenCalledWith(
      expect.objectContaining({ enableFetch: false }),
    )

    await user.click(screen.getByRole('button', { name: 'Recurring' }))

    expect(m.useDonationSubscriptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ enableFetch: true }),
    )
    expect(screen.getByText('#S1')).toBeTruthy()
    expect(screen.getByText('#S2')).toBeTruthy()
    expect(screen.getAllByText('Monthly').length).toBe(3)
    expect(screen.getByText('Active')).toBeTruthy()
    expect(screen.getByText('Past due')).toBeTruthy()
    expect(screen.getByText('Canceled')).toBeTruthy()
  })

  it('opens the detail modal from a transaction row', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    await user.click(screen.getAllByRole('button', { name: 'View donation' })[0])

    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByText('1 off donation')).toBeTruthy()
    expect(dialog.getByText('Mari')).toBeTruthy()
    expect(dialog.getByRole('button', { name: /Copy invoice URL/i })).toHaveProperty(
      'disabled',
      false,
    )
  })

  it('opens the modal for a recurring plan with the Monthly badge', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    await user.click(screen.getByRole('button', { name: 'Recurring' }))
    await user.click(screen.getAllByRole('button', { name: 'View donation' })[0])

    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByText('Recurring donation.')).toBeTruthy()
    expect(dialog.getByText('Monthly')).toBeTruthy()
    expect(dialog.getByText('Donation Status')).toBeTruthy()
    expect(dialog.getByRole('button', { name: /Copy invoice URL/i })).toHaveProperty(
      'disabled',
      false,
    )
  })

  it('switches to Monthly Summary and renders gross, refunded, and net per currency', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    await user.click(screen.getByRole('button', { name: 'Monthly Summary' }))

    expect(screen.getAllByText('USD 1,000.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('USD 50.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('USD 950.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('EUR 250.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('EUR 0.00').length).toBeGreaterThan(0)
  })

  it('requests the selected currency from the server for both lists', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    const select = screen.getAllByRole('combobox')[0]
    await user.click(select)
    await user.click(await screen.findByTitle('US Dollar'))

    expect(m.useDonations).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'usd', churchId: 'c1' }),
    )
    expect(m.useDonationSubscriptions).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'usd', churchId: 'c1' }),
    )
    expect(screen.getByText('950')).toBeTruthy()
    expect(screen.queryByText('250')).toBeNull()
  })

  it('sends the status filter to the transactions list only', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    // The status Select is the last combobox in the filter row.
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[combos.length - 1])
    await user.click(await screen.findByTitle('Failed'))

    expect(m.useDonations).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'FAILED', churchId: 'c1' }),
    )
    const lastSummaryOptions = m.useDonationSummary.mock.calls.at(-1)![0] as Record<string, unknown>
    expect(lastSummaryOptions).not.toHaveProperty('status')
  })

  it('handles empty states when queries return zero records', async () => {
    m.useDonations.mockReturnValue({ data: [], total: 0, loading: false })
    m.useDonationSubscriptions.mockReturnValue({ data: [], total: 0, loading: false })
    m.useDonationSummary.mockReturnValue({ data: { currencies: [] }, loading: false })

    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    expect(screen.getByText('0')).toBeTruthy() // Donation count
    expect(screen.getByText(/€ 0/)).toBeTruthy() // Confirmed amount
    expect(screen.getAllByText('No data').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Recurring' }))
    expect(screen.getAllByText('No data').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Monthly Summary' }))
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

    await user.click(screen.getByRole('button', { name: 'Recurring' }))
    expect(screen.getByText('Failed to load recurring donations')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Monthly Summary' }))
    expect(screen.getByText('Failed to load summary')).toBeTruthy()
  })

  it('enforces RBAC: shows access restriction and suppresses data fetch without the permission', () => {
    m.canRead = false
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    expect(screen.getByText('Access restricted')).toBeTruthy()
    expect(screen.getByText('You do not have permission to view donations.')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('keeps the page read-only: no refund, edit, delete, or subscription management controls', () => {
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    const unallowedText = /refund|edit|delete|manage/i
    expect(screen.queryAllByRole('button', { name: unallowedText })).toHaveLength(0)
    expect(screen.queryAllByRole('link', { name: unallowedText })).toHaveLength(0)
  })

  it('filters the Confirmed amount card and count badges when a currency is selected', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchDonations churchId="c1" />)

    const select = screen.getAllByRole('combobox')[0]
    await user.click(select)
    await user.click(await screen.findByTitle('Euro'))

    const card = screen.getByText('Confirmed donations amount').closest<HTMLElement>('.rounded-2xl')
    expect(card).not.toBeNull()
    expect(within(card!).getByText('250')).toBeTruthy()
    expect(within(card!).queryByText('950')).toBeNull()
    expect(screen.queryByText('950')).toBeNull()
    expect(screen.getAllByText('250').length).toBeGreaterThan(0)
  })
})
