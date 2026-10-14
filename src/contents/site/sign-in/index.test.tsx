import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import {
  axiosMock,
  pushMock,
  renderWithProviders,
  sessionMock,
  signInMock,
} from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsSiteSignIn from '.'

const en = SITE_MESSAGES.en

const renderPage = () =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteSignIn locale="en" />
    </SiteI18nProvider>,
  )

const fillAndSubmit = async (email = 'maria@example.com', password = 'Secret@123') => {
  await userEvent.type(screen.getByLabelText(en.signInIdentifierLabel), email)
  await userEvent.type(screen.getByLabelText(en.signInPasswordLabel), password)
  await userEvent.click(screen.getByRole('button', { name: new RegExp(en.signInSubmit) }))
}

describe('Customer sign-in (W01)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    signInMock.mockResolvedValue({ error: undefined, code: undefined })
    sessionMock.mockReturnValue({ data: { user: { user_id: 'u1' } } })
    axiosMock.get.mockResolvedValue({
      data: { result: { churchStepDone: true, localeStepDone: true, completed: true } },
    })
  })

  it('renders the designed sign-in screen', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: en.signInTitle })).toBeTruthy()
    expect(screen.getByText(en.signInQuote)).toBeTruthy()
    expect(screen.getByRole('link', { name: en.signInForgot }).getAttribute('href')).toBe(
      '/forgot-password',
    )
    expect(
      screen.getByRole('link', { name: new RegExp(en.signInBeginFellowship) }).getAttribute('href'),
    ).toBe('/register')
    // Aside is part of the page.
    expect(screen.getByText(en.sealTitle)).toBeTruthy()
  })

  it('signs in with the trimmed email and goes to /customer once setup is complete', async () => {
    renderPage()
    await fillAndSubmit('  maria@example.com ')

    expect(signInMock).toHaveBeenCalledWith('credentials', {
      name: 'maria@example.com',
      password: 'Secret@123',
      redirect: false,
    })
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/customer'))
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/me/setup-progress')
    expect(JSON.parse(localStorage.getItem('prayer365.setupProgress.u1') ?? '{}')).toMatchObject({
      completed: true,
    })
  })

  it('goes to /customer/setup while setup is incomplete', async () => {
    axiosMock.get.mockResolvedValue({
      data: { result: { churchStepDone: true, localeStepDone: false, completed: false } },
    })
    renderPage()
    await fillAndSubmit('maria@example.com')

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/customer/setup'))
  })

  it('goes to /customer without asking again when this browser already asked', async () => {
    localStorage.setItem(
      'prayer365.setupProgress.u1',
      JSON.stringify({ churchStepDone: false, localeStepDone: false, completed: false }),
    )
    renderPage()
    await fillAndSubmit('maria@example.com')

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/customer'))
    expect(axiosMock.get).not.toHaveBeenCalled()
  })

  it('falls back to /customer when progress cannot be read', async () => {
    axiosMock.get.mockRejectedValue(new Error('network down'))
    renderPage()
    await fillAndSubmit('maria@example.com')

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/customer'))
  })

  it('requires both fields before calling sign-in', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: new RegExp(en.signInSubmit) }))

    expect(await screen.findByText(en.signInIdentifierRequired)).toBeTruthy()
    expect(await screen.findByText(en.signInPasswordRequired)).toBeTruthy()
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('does not show required errors while typing, only after submit', async () => {
    renderPage()
    const email = screen.getByLabelText(en.signInIdentifierLabel)
    await userEvent.type(email, 'a')
    await userEvent.clear(email)

    expect(screen.queryByText(en.signInIdentifierRequired)).toBeNull()
  })

  it('locks the fields while signing in', async () => {
    let resolve!: (v: unknown) => void
    signInMock.mockReturnValue(new Promise((r) => (resolve = r)))
    renderPage()
    await fillAndSubmit()

    await waitFor(() =>
      expect(screen.getByLabelText(en.signInIdentifierLabel)).toHaveProperty('disabled', true),
    )
    expect(screen.getByLabelText(en.signInPasswordLabel)).toHaveProperty('disabled', true)

    resolve({ error: undefined })
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/customer'))
  })

  it('sends an unverified customer to the verify page', async () => {
    signInMock.mockResolvedValue({ error: 'x', code: 'EMAIL_NOT_VERIFIED' })
    renderPage()
    await fillAndSubmit()

    expect(pushMock).toHaveBeenCalledWith('/verify-account?email=maria%40example.com')
  })

  it.each(['PASSWORD_INVALID', 'USER_NOT_FOUND'])(
    'shows one credentials message for %s (no account enumeration)',
    async (code) => {
      signInMock.mockResolvedValue({ error: 'x', code })
      renderPage()
      await fillAndSubmit()

      expect(await screen.findByText(en.signInErrorCredentials)).toBeTruthy()
      expect(pushMock).not.toHaveBeenCalled()
    },
  )

  it('shows the general error for an unexpected failure', async () => {
    signInMock.mockResolvedValue({ error: 'Configuration', code: undefined })
    renderPage()
    await fillAndSubmit()

    expect(await screen.findByText(en.error)).toBeTruthy()
  })

  it('ChurchID and Magic Link buttons are UI only', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: en.signInChurchId }))
    await userEvent.click(screen.getByRole('button', { name: en.signInMagicLink }))

    expect(signInMock).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })
})
