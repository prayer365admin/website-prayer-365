import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { axiosMock, renderWithProviders } from '@/test/frontend/render'
import ContentsSiteGiveThankYou from './thank-you'

const renderScreen = ({
  sessionId = 'cs_1',
  initialStatus = null,
}: {
  sessionId?: string | null
  initialStatus?: {
    state: 'confirmed' | 'pending' | 'failed'
    amountMinor: number | null
    currency: string | null
    paidAt: string | null
  } | null
} = {}) =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteGiveThankYou initialStatus={initialStatus} sessionId={sessionId} />
    </SiteI18nProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  axiosMock.get.mockResolvedValue({
    data: {
      result: { state: 'pending', amountMinor: null, currency: null, paidAt: null },
    },
  })
})

describe('ContentsSiteGiveThankYou — public outcome', () => {
  it('paints the server read immediately (pending)', () => {
    renderScreen({
      initialStatus: { state: 'pending', amountMinor: null, currency: null, paidAt: null },
    })

    expect(screen.getByText(SITE_MESSAGES.en.publicGivePendingTitle)).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.en.donateResultChecking)).toBeTruthy()
  })

  it('shows the confirmed view with the ledger amount and the Stripe receipt notice', () => {
    renderScreen({
      initialStatus: {
        state: 'confirmed',
        amountMinor: 1000,
        currency: 'EUR',
        paidAt: '2026-11-12T09:15:00.000Z',
      },
    })

    expect(screen.getByText(SITE_MESSAGES.en.publicGiveThanksTitle)).toBeTruthy()
    expect(screen.getByText('€10.00')).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.en.publicGiveThanksEmailNotice)).toBeTruthy()
  })

  it('shows the failed view for a session that is not the platform\u2019s own (server 404 → null)', () => {
    renderScreen({ sessionId: null, initialStatus: null })

    expect(screen.getByText(SITE_MESSAGES.en.publicGiveFailedTitle)).toBeTruthy()
    // No session to ask about → no status request at all.
    expect(axiosMock.get).not.toHaveBeenCalled()
  })

  it('picks up a later state from the polling endpoint', async () => {
    axiosMock.get.mockResolvedValue({
      data: {
        result: { state: 'confirmed', amountMinor: 2500, currency: 'EUR', paidAt: null },
      },
    })
    renderScreen({
      initialStatus: { state: 'pending', amountMinor: null, currency: null, paidAt: null },
    })

    expect(await screen.findByText(SITE_MESSAGES.en.publicGiveThanksTitle)).toBeTruthy()
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/donations/public/status', {
      params: { sessionId: 'cs_1' },
    })
    expect(screen.getByText('€25.00')).toBeTruthy()
  })
})
