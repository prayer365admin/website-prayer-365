import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { DonationStatusView } from '@/models/donation'
import { axiosMock } from '@/test/frontend/render'
import ContentsSiteDonationResult from './index'

const attempt = {
  sessionId: 'cs_1',
  churchId: 'c1',
  amountMinor: 1234,
  currency: 'eur',
  frequency: 'monthly' as const,
}

const confirmed: DonationStatusView = {
  state: 'confirmed',
  churchId: 'c1',
  churchName: "St. John's",
  amountMinor: 1234,
  currency: 'EUR',
  frequency: 'monthly',
  receiptSeen: true,
}

const renderResult = (initialStatus: DonationStatusView) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SiteI18nProvider initialLocale="en">
        <ContentsSiteDonationResult attempt={attempt} initialStatus={initialStatus} />
      </SiteI18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('ContentsSiteDonationResult (W12)', () => {
  it('shows the confirmed state, summary and next steps for a settled gift', () => {
    renderResult(confirmed)

    expect(screen.getByRole('heading', { name: 'Thank you — your gift is confirmed' })).toBeTruthy()
    expect(screen.getByText("St. John's")).toBeTruthy()
    expect(screen.getByText('€12.34')).toBeTruthy()
    expect(screen.getByText('Monthly pledge')).toBeTruthy()
    expect(screen.getByText('Next steps')).toBeTruthy()
    // A confirmed gift needs no further polling.
    expect(axiosMock.get).not.toHaveBeenCalled()
  })

  it('stays pending and keeps checking when nothing is recorded yet', async () => {
    axiosMock.get.mockResolvedValue({
      data: { result: { ...confirmed, state: 'pending', receiptSeen: false } },
    })

    renderResult({ ...confirmed, state: 'pending', receiptSeen: false })

    expect(screen.getByRole('heading', { name: 'Your gift is being confirmed' })).toBeTruthy()
    await waitFor(() => expect(axiosMock.get).toHaveBeenCalled())
    expect(screen.queryByText('Thank you — your gift is confirmed')).toBeNull()
  })

  it('never turns a pending attempt into a confirmed one on its own', async () => {
    // The status endpoint keeps answering pending: the page must not invent success.
    axiosMock.get.mockResolvedValue({
      data: { result: { ...confirmed, state: 'pending', receiptSeen: true } },
    })

    renderResult({ ...confirmed, state: 'pending', receiptSeen: true })

    await waitFor(() => expect(axiosMock.get).toHaveBeenCalled())
    expect(screen.queryByText('Thank you — your gift is confirmed')).toBeNull()
    expect(
      screen.getByText('Payment received. We are recording your gift in the parish ledger.'),
    ).toBeTruthy()
  })

  it('offers a retry for a failed attempt', () => {
    renderResult({ ...confirmed, state: 'failed', paidAt: null } as unknown as DonationStatusView)

    expect(screen.getByRole('heading', { name: 'The payment did not complete' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Try again' }).getAttribute('href')).toBe('/donate/c1')
  })
})
