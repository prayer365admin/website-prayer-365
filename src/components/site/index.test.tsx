import { SiteI18nProvider } from '@/i18n/site-i18n'
import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SiteShell from '.'

describe('SiteShell', () => {
  it('wraps website content with the customer header and footer', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteShell>Customer profile</SiteShell>
      </SiteI18nProvider>,
    )

    expect(screen.getByRole('banner')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Account' }).getAttribute('href')).toBe('/customer')
    expect(screen.getByText('Customer profile')).toBeTruthy()
    expect(screen.getByRole('contentinfo')).toBeTruthy()
  })
})
