import { SiteI18nProvider } from '@/i18n/site-i18n'
import { SITE_MESSAGES } from '@/i18n/messages'
import {
  axiosMock,
  pathnameMock,
  renderWithProviders,
  searchParamsMock,
  sessionMock,
} from '@/test/frontend/render'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import SiteTopBar from './top-bar'

const link = (name: string) => screen.getByRole('link', { name })

describe('SiteTopBar', () => {
  beforeEach(() => {
    sessionMock.mockReturnValue({ data: { user: { user_id: 'u1' } }, status: 'authenticated' })
    pathnameMock.mockReturnValue('/dashboard/customers')
    searchParamsMock.get.mockReturnValue(null)
  })

  it('shows the general customer navigation, church control, locale and account menu', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    expect(screen.getByRole('link', { name: 'Prayer 365 home' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Discovery Churches' })).toBeTruthy()
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

    const navigation = screen.getByRole('navigation', { name: SITE_MESSAGES.en.headerPrimaryNav })
    expect(
      Array.from(navigation.querySelectorAll('a')).map((item) => [
        item.textContent,
        item.getAttribute('href'),
      ]),
    ).toEqual([
      [SITE_MESSAGES.en.headerDiscoverChurches, '/churches'],
      [SITE_MESSAGES.en.headerPrayers, '/prayers'],
      [SITE_MESSAGES.en.headerGiving, '/giving'],
    ])
    expect(screen.queryByRole('link', { name: SITE_MESSAGES.en.headerEvents })).toBeNull()
    expect(screen.queryByRole('link', { name: SITE_MESSAGES.en.headerSearch })).toBeNull()
    expect(screen.queryByRole('link', { name: /notifications/i })).toBeNull()
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

  it('keeps Prayers visually active on the prayer page and its child pages', () => {
    pathnameMock.mockReturnValue('/prayers')

    const { unmount } = renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    const prayersLink = link(SITE_MESSAGES.en.headerPrayers)
    expect(prayersLink.getAttribute('aria-current')).toBe('page')
    expect(prayersLink.className).toContain('activeNavigationLink')

    unmount()
    pathnameMock.mockReturnValue('/prayers/prayer-1')
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    expect(link(SITE_MESSAGES.en.headerPrayers).getAttribute('aria-current')).toBe('page')
    expect(link(SITE_MESSAGES.en.headerPrayers).className).toContain('activeNavigationLink')
  })

  it('shows the selected prayer church and switches the archive from the header', async () => {
    pathnameMock.mockReturnValue('/prayers')
    searchParamsMock.get.mockImplementation((key) => (key === 'churchId' ? 'c2' : null))
    const churches = [
      {
        churchId: 'c1',
        churchName: 'Hope Church',
        city: null,
        address: null,
        coverAssetId: null,
        coverUrl: null,
        isMain: true,
        isFollowed: true,
      },
      {
        churchId: 'c2',
        churchName: 'Grace Church',
        city: null,
        address: null,
        coverAssetId: null,
        coverUrl: null,
        isMain: false,
        isFollowed: true,
      },
    ]

    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar initialChurches={churches} />
      </SiteI18nProvider>,
    )

    expect(screen.getByText('Grace Church')).toBeTruthy()
    const picker = screen.getByRole('button', { name: SITE_MESSAGES.en.headerChooseChurch })
    fireEvent.click(picker)
    const hope = await screen.findByRole('link', { name: 'Hope Church' })
    expect(hope.getAttribute('href')).toBe('/prayers?churchId=c1')
    expect(screen.getByRole('link', { name: 'Grace Church' }).getAttribute('aria-current')).toBe(
      'page',
    )
    expect(
      screen
        .getByRole('link', { name: SITE_MESSAGES.en.headerBrowseChurches })
        .getAttribute('href'),
    ).toBe('/churches')
    expect(picker.getAttribute('aria-expanded')).toBe('true')
  })

  it('does not mark Prayers active for a similarly prefixed route', () => {
    pathnameMock.mockReturnValue('/prayers-archive')

    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    expect(link(SITE_MESSAGES.en.headerPrayers).getAttribute('aria-current')).toBeNull()
    expect(link(SITE_MESSAGES.en.headerPrayers).className).not.toContain('activeNavigationLink')
  })

  it('offers the directory when the customer follows no church', async () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    const picker = screen.getByRole('button', { name: SITE_MESSAGES.en.headerChooseChurch })
    fireEvent.click(picker)

    const browse = await screen.findByRole('link', { name: SITE_MESSAGES.en.headerBrowseChurches })
    expect(browse.getAttribute('href')).toBe('/churches')
    fireEvent.click(browse)
    await waitFor(() => expect(picker.getAttribute('aria-expanded')).toBe('false'))
  })

  it('uses a responsive modal church picker', async () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar
          initialChurches={[
            {
              churchId: 'c1',
              churchName: 'Hope Church',
              city: 'Tallinn',
              address: null,
              coverAssetId: null,
              coverUrl: null,
              isMain: true,
              isFollowed: true,
            },
          ]}
        />
      </SiteI18nProvider>,
    )

    const picker = screen.getByRole('button', { name: SITE_MESSAGES.en.headerChooseChurch })
    fireEvent.click(picker)

    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Hope Church' })).toBeTruthy()
    const browseChurches = screen.getByRole('link', {
      name: SITE_MESSAGES.en.headerBrowseChurches,
    })
    expect(browseChurches).toBeTruthy()

    fireEvent.click(browseChurches)

    await waitFor(() => expect(picker.getAttribute('aria-expanded')).toBe('false'))
  })

  it('shows the account-flow navigation without customer discovery links', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar variant="auth" />
      </SiteI18nProvider>,
    )

    expect(screen.getByRole('navigation', { name: 'Account navigation' })).toBeTruthy()
    expect(screen.getByRole('link', { name: SITE_MESSAGES.en.signInBeginFellowship })).toBeTruthy()
    expect(screen.queryByRole('link', { name: SITE_MESSAGES.en.headerHome })).toBeNull()
    expect(screen.queryByRole('link', { name: SITE_MESSAGES.en.account })).toBeNull()
    expect(screen.queryByRole('link', { name: SITE_MESSAGES.en.headerSpiritualWalk })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Discovery Churches' })).toBeNull()
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

    expect(link('Homepage').getAttribute('aria-current')).toBe('page')

    unmount()
    pathnameMock.mockReturnValue('/events')
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    expect(link('Homepage').getAttribute('aria-current')).toBeNull()
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
