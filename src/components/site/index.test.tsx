import { SiteI18nProvider } from '@/i18n/site-i18n'
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
    expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeTruthy()
    expect(screen.getByText('Customer profile')).toBeTruthy()
    expect(screen.getByRole('contentinfo')).toBeTruthy()
    expect(screen.getByText('24/7 Spiritual Hotline')).toBeTruthy()
  })
})
