import { renderWithProviders } from '@/test/frontend/render'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsDashboardDonations from '.'

const m = vi.hoisted(() => ({
  canRead: true,
  useAdminDonations: vi.fn(),
  useAdminDonationSummary: vi.fn(),
  useAdminDonationSubscriptions: vi.fn(),
  useAdminDonationSummaryMonthly: vi.fn(),
  useCentralChurches: vi.fn(),
}))

vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    readAny: () => ({ granted: m.canRead }),
    readOwn: () => ({ granted: false }),
  }),
}))

vi.mock('@/hooks/data/donation', () => ({
  useAdminDonations: (...args: unknown[]) => m.useAdminDonations(...args),
  useAdminDonationSummary: (...args: unknown[]) => m.useAdminDonationSummary(...args),
  useAdminDonationSubscriptions: (...args: unknown[]) => m.useAdminDonationSubscriptions(...args),
  useAdminDonationSummaryMonthly: (...args: unknown[]) => m.useAdminDonationSummaryMonthly(...args),
}))

vi.mock('@/hooks/data/central', () => ({
  useCentralChurches: (...args: unknown[]) => m.useCentralChurches(...args),
}))

const monthStart = dayjs().startOf('month').startOf('day').toISOString()
const monthEnd = dayjs().endOf('month').endOf('day').toISOString()

const rows = [
  {
    id: 'd1',
    amountMinor: '500',
    currency: 'EUR',
    status: 'PAID',
    paidAt: new Date('2026-11-13T06:26:42.000Z'),
    ref: 'pi_1',
    churchId: 'p1',
    churchName: 'Prayer 365',
    type: 'PRAYER',
    refundedMinor: '0',
    donor: null,
    invoiceUrl: null,
  },
  {
    id: 'd2',
    amountMinor: '1200',
    currency: 'EUR',
    status: 'PAID',
    paidAt: new Date('2026-11-12T06:26:42.000Z'),
    ref: 'pi_2',
    churchId: 'c1',
    churchName: 'St Mary',
    type: 'CHURCH',
    refundedMinor: '0',
    donor: { name: 'Mari', email: 'mari@example.com' },
    invoiceUrl: 'https://pay.stripe.test/receipt/abc',
  },
]

const recurringRows = [
  {
    id: 's1',
    amountMinor: '2000',
    currency: 'EUR',
    providerStatus: 'active',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    churchId: 'c1',
    churchName: 'St Mary',
    frequency: 'Monthly',
    invoiceUrl: 'https://pay.stripe.test/receipt/sub1',
  },
]

const monthlyRows = [
  {
    month: '2026-11',
    currency: 'eur',
    grossMinor: '1700',
    refundedMinor: '0',
    netMinor: '1700',
    count: 2,
  },
]

const bucket = (gross: string, count: number) => ({
  grossMinor: gross,
  refundedMinor: '0',
  netMinor: gross,
  count,
})

const summary = {
  from: new Date(monthStart),
  to: new Date(monthEnd),
  currencies: [
    {
      currency: 'EUR',
      total: bucket('1700', 2),
      church: bucket('1200', 1),
      prayer: bucket('500', 1),
    },
  ],
}

describe('ContentsDashboardDonations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.canRead = true
    m.useCentralChurches.mockReturnValue({
      data: [
        { id: 'p1', name: 'Prayer 365', status: 'APPROVED', isPlatform: true },
        { id: 'c1', name: 'St Mary', status: 'APPROVED', isPlatform: false },
      ],
    })
    m.useAdminDonations.mockReturnValue({ data: rows, total: 2, loading: false })
    m.useAdminDonationSummary.mockReturnValue({ data: summary, loading: false })
    m.useAdminDonationSubscriptions.mockReturnValue({
      data: recurringRows,
      total: 1,
      loading: false,
    })
    m.useAdminDonationSummaryMonthly.mockReturnValue({ data: monthlyRows, loading: false })
  })

  it('renders the two stat cards with per-currency badges and the all-church table', () => {
    renderWithProviders(<ContentsDashboardDonations />)

    expect(screen.getByText('Confirmed donations amount')).toBeTruthy()
    expect(screen.getByText('Donation Count')).toBeTruthy()
    expect(screen.getAllByText('Euro (2)').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('17')).toBeTruthy()

    expect(screen.getByText('Prayer 365')).toBeTruthy()
    expect(screen.getByText('St Mary')).toBeTruthy()
  })

  it('asks for the current month on first paint', () => {
    renderWithProviders(<ContentsDashboardDonations />)

    expect(m.useAdminDonations).toHaveBeenCalledWith(
      expect.objectContaining({ from: monthStart, to: monthEnd, page: 1 }),
    )
    expect(m.useAdminDonationSummary).toHaveBeenCalledWith(
      expect.objectContaining({ from: monthStart, to: monthEnd }),
    )
  })

  it('narrows the list and the cards to the chosen church', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsDashboardDonations />)

    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(await screen.findByTitle('St Mary'))

    expect(m.useAdminDonations).toHaveBeenLastCalledWith(
      expect.objectContaining({ churchId: 'c1' }),
    )
    expect(m.useAdminDonationSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ churchId: 'c1' }),
    )
  })

  it('filters Church donations client-side without a server church param (Type=Church)', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsDashboardDonations />)

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(await screen.findByTitle('Church Donation'))

    expect(screen.queryByText('Prayer 365')).toBeNull()
    expect(screen.getByText('St Mary')).toBeTruthy()
    expect(m.useAdminDonations).toHaveBeenLastCalledWith(
      expect.objectContaining({ churchId: undefined }),
    )
  })

  it('sends the platform id when Type=Prayer', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsDashboardDonations />)

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(await screen.findByTitle('Prayer Donation'))

    expect(m.useAdminDonations).toHaveBeenLastCalledWith(
      expect.objectContaining({ churchId: 'p1' }),
    )
  })

  it('opens the detail modal from the eye and disables copy for a row without an invoice', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsDashboardDonations />)

    const table = screen.getByRole('table')
    await user.click(within(table).getAllByRole('button', { name: 'View donation' })[0])

    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByText('1 off donation')).toBeTruthy()
    expect(dialog.getByText('Guest')).toBeTruthy()
    expect(dialog.getByRole('button', { name: /Copy invoice URL/i })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('shows the donor and an enabled copy button for a paid row with an invoice', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsDashboardDonations />)

    const table = screen.getByRole('table')
    await user.click(within(table).getAllByRole('button', { name: 'View donation' })[1])

    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByText('1 off donation')).toBeTruthy()
    expect(dialog.getByText('Mari')).toBeTruthy()
    expect(dialog.getByRole('button', { name: /Copy invoice URL/i })).toHaveProperty(
      'disabled',
      false,
    )
  })

  it('fetches the all-church recurring list only on the Recurring tab', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsDashboardDonations />)

    expect(m.useAdminDonationSubscriptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ enableFetch: false }),
    )

    await user.click(screen.getByRole('button', { name: 'Recurring' }))

    expect(m.useAdminDonationSubscriptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ enableFetch: true, churchId: undefined }),
    )
    expect(screen.getByText('Monthly')).toBeTruthy()
  })

  it('fetches the monthly summary for year-to-date on the Monthly Summary tab', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsDashboardDonations />)

    await user.click(screen.getByRole('button', { name: 'Monthly Summary' }))

    expect(m.useAdminDonationSummaryMonthly).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enableFetch: true,
        from: dayjs().startOf('year').toISOString(),
        to: monthEnd,
      }),
    )
    expect(screen.getByText('November 2026')).toBeTruthy()
    // Gross and net both read EUR 17.00 for a month with no refunds.
    expect(screen.getAllByText('EUR 17.00').length).toBe(2)
  })

  it('renders the restricted state on a 403 instead of an error alert', () => {
    const forbidden = Object.assign(new Error('Forbidden'), {
      isAxiosError: true,
      response: { status: 403 },
    })
    m.useAdminDonations.mockReturnValue({ data: [], total: 0, loading: false, error: forbidden })
    m.useAdminDonationSummary.mockReturnValue({ data: undefined, loading: false, error: forbidden })

    renderWithProviders(<ContentsDashboardDonations />)

    expect(screen.getByText('Access restricted')).toBeTruthy()
    expect(
      screen.getByText('This page is only available for platform administrators.'),
    ).toBeTruthy()
    expect(screen.queryByText('Failed to load donations')).toBeNull()
  })

  it('suppresses every read without the donation permission', () => {
    m.canRead = false
    renderWithProviders(<ContentsDashboardDonations />)

    expect(screen.getByText('Access restricted')).toBeTruthy()
    expect(m.useAdminDonations).toHaveBeenCalledWith(
      expect.objectContaining({ enableFetch: false }),
    )
    expect(m.useAdminDonationSubscriptions).toHaveBeenCalledWith(
      expect.objectContaining({ enableFetch: false }),
    )
    expect(m.useAdminDonationSummaryMonthly).toHaveBeenCalledWith(
      expect.objectContaining({ enableFetch: false }),
    )
  })
})
