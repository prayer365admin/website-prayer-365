import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { axiosMock, renderWithProviders } from '@/test/frontend/render'
import ContentsSiteGiveThankYou from './thank-you'

const renderScreen = ({
  sessionId = 'cs_1',
  initialStatus = null,
  unknown = false,
  notReady = false,
}: {
  sessionId?: string | null
  initialStatus?: {
    state: 'confirmed' | 'refunded' | 'pending' | 'failed' | 'unknown'
    amountMinor: number | null
    currency: string | null
    paidAt: string | null
  } | null
  unknown?: boolean
  notReady?: boolean
} = {}) =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteGiveThankYou
        initialStatus={initialStatus}
        notReady={notReady}
        sessionId={sessionId}
        unknown={unknown}
      />
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

  it('shows the confirmed view as the same receipt card the parish result uses', () => {
    renderScreen({
      initialStatus: {
        state: 'confirmed',
        amountMinor: 1000,
        currency: 'EUR',
        paidAt: '2026-11-12T09:15:00.000Z',
      },
    })

    expect(screen.getByText(SITE_MESSAGES.en.donateResultConfirmedTitle)).toBeTruthy()
    expect(screen.getByText('Prayer 365')).toBeTruthy()
    expect(screen.getByText('€10.00')).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.en.donateResultFrequencyOnce)).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.en.donateResultNextSteps)).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.en.publicGiveThanksEmailNotice)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: SITE_MESSAGES.en.donateResultWatchVideo }),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: SITE_MESSAGES.en.donateResultBack }).getAttribute('href'),
    ).toBe('/give')
  })

  it('plays the thank-you video for a confirmed gift, same as the parish result', () => {
    const { container } = renderScreen({
      initialStatus: {
        state: 'confirmed',
        amountMinor: 1000,
        currency: 'EUR',
        paidAt: '2026-11-12T09:15:00.000Z',
      },
    })

    expect(container.querySelector('video')?.getAttribute('src')).toBe('/videos/thankyou.webm')
  })

  it('keeps the video closed for a gift that is not confirmed', () => {
    const { container } = renderScreen({
      initialStatus: {
        state: 'refunded',
        amountMinor: 1000,
        currency: 'EUR',
        paidAt: '2026-11-12T09:15:00.000Z',
      },
    })

    expect(container.querySelector('video')).toBeNull()
  })

  it('shows the unknown view for a session that is not the platform\u2019s own (server 404)', () => {
    renderScreen({ sessionId: null, initialStatus: null, unknown: true })

    expect(screen.getByText(SITE_MESSAGES.en.publicGiveUnknownTitle)).toBeTruthy()
    expect(screen.queryByText(SITE_MESSAGES.en.publicGiveFailedTitle)).toBeNull()
    // No session to ask about → no status request at all.
    expect(axiosMock.get).not.toHaveBeenCalled()
  })

  it('shows refunded with the ledger amount and the receipt notice', () => {
    renderScreen({
      initialStatus: {
        state: 'refunded',
        amountMinor: 1000,
        currency: 'EUR',
        paidAt: '2026-11-12T09:15:00.000Z',
      },
    })

    expect(screen.getByText(SITE_MESSAGES.en.publicGiveRefundedTitle)).toBeTruthy()
    expect(screen.getByText('€10.00')).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.en.publicGiveThanksEmailNotice)).toBeTruthy()
  })

  it('shows the unavailable view when the server answered 503', () => {
    renderScreen({ sessionId: 'cs_1', initialStatus: null, notReady: true })

    expect(screen.getByText(SITE_MESSAGES.en.publicGiveNotReadyTitle)).toBeTruthy()
    // A disabled integration answers 503, so retrying the read would only 503 again.
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

    expect(await screen.findByText(SITE_MESSAGES.en.donateResultConfirmedTitle)).toBeTruthy()
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/donations/public/status', {
      params: { sessionId: 'cs_1' },
    })
    expect(screen.getByText('€25.00')).toBeTruthy()
  })
})
