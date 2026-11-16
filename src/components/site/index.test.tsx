import { SiteI18nProvider } from '@/i18n/site-i18n'
import { SITE_MESSAGES } from '@/i18n/messages'
import { renderWithProviders, sessionMock } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import SiteShell from '.'

describe('SiteShell', () => {
  beforeEach(() => {
    sessionMock.mockReturnValue({ data: { user: { user_id: 'u1' } }, status: 'authenticated' })
  })

  it('wraps website content with the customer header and footer', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteShell>Customer profile</SiteShell>
      </SiteI18nProvider>,
    )

    expect(screen.getByRole('banner')).toBeTruthy()
    expect(screen.getByRole('link', { name: SITE_MESSAGES.en.account })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: SITE_MESSAGES.en.headerPrimaryNav })).toBeTruthy()
    expect(screen.getByText('Customer profile')).toBeTruthy()
    expect(screen.getByRole('contentinfo')).toBeTruthy()
    expect(screen.getByRole('heading', { name: SITE_MESSAGES.en.footerParishHeading })).toBeTruthy()
    const footerNavigation = screen.getByRole('navigation', {
      name: SITE_MESSAGES.en.footerParishHeading,
    })
    expect(
      Array.from(footerNavigation.querySelectorAll('a')).map((item) => [
        item.textContent,
        item.getAttribute('href'),
      ]),
    ).toEqual([
      [SITE_MESSAGES.en.headerHome, '/'],
      [SITE_MESSAGES.en.headerDiscoverChurches, '/churches'],
      [SITE_MESSAGES.en.headerPrayers, '/prayers'],
      [SITE_MESSAGES.en.headerGiving, '/donate'],
    ])
    expect(
      screen.getByRole('heading', { name: SITE_MESSAGES.en.footerSupportHeading }),
    ).toBeTruthy()
  })

  it('never renders a phone number while no verified hotline exists', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteShell>Customer profile</SiteShell>
      </SiteI18nProvider>,
    )

    expect(document.querySelector('a[href^="tel:"]')).toBeNull()
    expect(
      screen.getByRole('link', { name: SITE_MESSAGES.en.contactPastoralCare }).getAttribute('href'),
    ).toBe('/churches')
  })

  it('can render recovery pages without the site header', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteShell footerVariant="legal-only" headerVariant="none">
          Recovery
        </SiteShell>
      </SiteI18nProvider>,
    )

    expect(screen.queryByRole('banner')).toBeNull()
    expect(screen.getByText('Recovery')).toBeTruthy()
    expect(screen.getByRole('contentinfo')).toBeTruthy()
  })

  // The shell is a client component, so the language switch must reach the footer copy.
  it('renders the chrome in the provider language', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="et">
        <SiteShell>Customer profile</SiteShell>
      </SiteI18nProvider>,
    )

    expect(screen.getByText(SITE_MESSAGES.et.footerParishHeading)).toBeTruthy()
    expect(
      screen
        .getByRole('navigation', { name: SITE_MESSAGES.et.headerPrimaryNav })
        .querySelector('a[href="/churches"]')?.textContent,
    ).toBe(SITE_MESSAGES.et.headerDiscoverChurches)
  })
})
