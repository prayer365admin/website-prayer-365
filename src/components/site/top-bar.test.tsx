import { SiteI18nProvider } from '@/i18n/site-i18n'
import { SITE_MESSAGES } from '@/i18n/messages'
import { axiosMock, pathnameMock, renderWithProviders, sessionMock } from '@/test/frontend/render'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import SiteTopBar from './top-bar'

const link = (name: string) => screen.getByRole('link', { name })

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
    expect(link('Account').getAttribute('href')).toBe('/customer')
  })

  it('shows the profile photo as the account link and drops the account menu', async () => {
    axiosMock.get.mockImplementation((url: string) =>
      Promise.resolve({
        data: {
          result:
            url === '/api/v1/site/me'
              ? { id: 'u1', profilePicture: 'https://cdn.test/me.png' }
              : [],
        },
      }),
    )
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    const account = link('Account')
    await waitFor(() =>
      expect(account.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/me.png'),
    )
    expect(account.getAttribute('href')).toBe('/customer')
    fireEvent.click(account)
    expect(screen.queryByText('Sign out')).toBeNull()
  })

  it('renders the server-loaded avatar before the client session resolves', () => {
    sessionMock.mockReturnValue({ data: null, status: 'loading' })
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar
          initialMe={{
            id: 'u1',
            email: 'maria@example.com',
            name: 'Maria',
            locale: 'en',
            profilePicture: 'https://cdn.test/me.png',
            mainChurchId: null,
          }}
        />
      </SiteI18nProvider>,
    )

    const account = link('Account')
    expect(account.getAttribute('href')).toBe('/customer')
    expect(account.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/me.png')
  })

  it('points the primary navigation at the website routes', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    expect(link(SITE_MESSAGES.en.headerDiscoverChurches).getAttribute('href')).toBe('/churches')
    expect(link(SITE_MESSAGES.en.headerEvents).getAttribute('href')).toBe('/events')
    expect(link(SITE_MESSAGES.en.headerGiving).getAttribute('href')).toBe('/giving')
    expect(link(SITE_MESSAGES.en.headerPrayers).getAttribute('href')).toBe('/prayers')
    expect(link(SITE_MESSAGES.en.headerSearch).getAttribute('href')).toBe('/search')
    expect(link(SITE_MESSAGES.en.headerNotifications).getAttribute('href')).toBe('/notifications')
  })

  it('marks the current page and its sub-pages in the navigation', () => {
    pathnameMock.mockReturnValue('/churches/c1/prayers')

    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    expect(link(SITE_MESSAGES.en.headerDiscoverChurches).getAttribute('aria-current')).toBe('page')
    expect(link(SITE_MESSAGES.en.headerPrayers).getAttribute('aria-current')).toBeNull()
  })

  it('offers the directory when the customer follows no church', async () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: SITE_MESSAGES.en.headerChooseChurch }))

    const browse = await screen.findByRole('link', { name: SITE_MESSAGES.en.headerBrowseChurches })
    expect(browse.getAttribute('href')).toBe('/churches')
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

  it('marks the sign-in link active on the sign-in page', () => {
    pathnameMock.mockReturnValue('/login')

    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar variant="auth" />
      </SiteI18nProvider>,
    )

    expect(link(SITE_MESSAGES.en.headerSignIn).getAttribute('aria-current')).toBe('page')
    expect(link(SITE_MESSAGES.en.signInBeginFellowship).getAttribute('aria-current')).toBeNull()
  })

  it('marks Begin Fellowship active only on the registration page', () => {
    pathnameMock.mockReturnValue('/register')

    const { unmount } = renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar variant="auth" />
      </SiteI18nProvider>,
    )

    expect(link(SITE_MESSAGES.en.signInBeginFellowship).getAttribute('aria-current')).toBe('page')
    expect(link(SITE_MESSAGES.en.headerSignIn).getAttribute('aria-current')).toBeNull()

    unmount()
    pathnameMock.mockReturnValue('/forgot-password')
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar variant="auth" />
      </SiteI18nProvider>,
    )

    expect(link(SITE_MESSAGES.en.headerSignIn).getAttribute('aria-current')).toBeNull()
    expect(link(SITE_MESSAGES.en.signInBeginFellowship).getAttribute('aria-current')).toBeNull()
  })

  it('keeps Begin Fellowship active during customer setup', () => {
    pathnameMock.mockReturnValue('/customer/setup')

    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar variant="auth" />
      </SiteI18nProvider>,
    )

    expect(link(SITE_MESSAGES.en.signInBeginFellowship).getAttribute('aria-current')).toBe('page')
    expect(link(SITE_MESSAGES.en.headerSignIn).getAttribute('aria-current')).toBeNull()
  })

  it('marks the home button active only on the home page', () => {
    pathnameMock.mockReturnValue('/')

    const { unmount } = renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    expect(link('Home').getAttribute('aria-current')).toBe('page')

    unmount()
    pathnameMock.mockReturnValue('/events')
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    expect(link('Home').getAttribute('aria-current')).toBeNull()
  })

  it('renders the navigation in the provider language', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="sv">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    expect(screen.getByRole('link', { name: SITE_MESSAGES.sv.headerDiscoverChurches })).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.sv.headerChooseChurch)).toBeTruthy()
  })
})
