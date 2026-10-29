import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import ContentsSiteDonationReturn from './index'

const renderPage = (outcome: string | null, locale: 'en' | 'et' = 'en') =>
  render(
    <SiteI18nProvider initialLocale={locale}>
      <ContentsSiteDonationReturn outcome={outcome} />
    </SiteI18nProvider>,
  )

describe('ContentsSiteDonationReturn (WB4b)', () => {
  it('tells a returning giver the gift is being confirmed and hands them to the app', () => {
    renderPage('success')

    expect(
      screen.getByRole('heading', { name: 'Thank you — your gift is being confirmed' }),
    ).toBeTruthy()
    expect(screen.getByText(/Open the Prayer365 app to see the result/)).toBeTruthy()
  })

  it('says nothing was charged after a cancel', () => {
    renderPage('cancel')

    expect(screen.getByRole('heading', { name: 'Payment cancelled' })).toBeTruthy()
    expect(screen.getByText(/nothing was charged/)).toBeTruthy()
  })

  it('falls back to a neutral state for a missing or unknown outcome', () => {
    renderPage(null, 'en')
    expect(screen.getByRole('heading', { name: 'Back to Prayer365' })).toBeTruthy()
  })

  it('never claims to confirm a payment', () => {
    renderPage('success')
    expect(screen.getAllByText(/cannot change or confirm a payment/)).toHaveLength(1)
  })

  it('offers both ways back into the site', () => {
    renderPage('success')

    expect(screen.getByRole('link', { name: 'Back to giving' }).getAttribute('href')).toBe(
      '/donate',
    )
    expect(screen.getByRole('link', { name: 'Browse churches' }).getAttribute('href')).toBe(
      '/churches',
    )
  })

  it('renders the translated copy, not English, for a non-English locale', () => {
    renderPage('success', 'et')
    expect(screen.getByRole('heading', { name: 'Aitäh — sinu annetust kinnitatakse' })).toBeTruthy()
  })
})
