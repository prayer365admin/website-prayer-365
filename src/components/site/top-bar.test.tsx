import { SiteI18nProvider } from '@/i18n/site-i18n'
import { pathnameMock, renderWithProviders, sessionMock } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import SiteTopBar from './top-bar'

describe('SiteTopBar', () => {
  beforeEach(() => {
    sessionMock.mockReturnValue({ data: { user: { user_id: 'u1' } }, status: 'authenticated' })
    pathnameMock.mockReturnValue('/dashboard/customers')
  })

  it('shows the general customer navigation, church control, locale and account menu', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    expect(screen.getByRole('link', { name: 'Prayer 365 home' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Discover Churches' })).toBeTruthy()
    expect(screen.getByText('Choose a church')).toBeTruthy()
    expect(screen.getByRole('combobox')).toBeTruthy()
    expect(screen.getByRole('combobox').getAttribute('aria-label')).toBe('Language')
    expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy()
  })

  it('shows the account-flow navigation without customer discovery links', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar variant="auth" />
      </SiteI18nProvider>,
    )

    expect(screen.getByRole('navigation', { name: 'Account navigation' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Begin Fellowship' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Discover Churches' })).toBeNull()
  })

  it('marks the home button active only on the home page', () => {
    pathnameMock.mockReturnValue('/')

    const { unmount } = renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page')

    unmount()
    pathnameMock.mockReturnValue('/events')
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBeNull()
  })
})
