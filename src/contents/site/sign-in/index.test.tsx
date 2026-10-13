import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { pushMock, renderWithProviders, signInMock } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
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
    signInMock.mockResolvedValue({ error: undefined, code: undefined })
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

  it('signs in with the trimmed email and goes home', async () => {
    renderPage()
    await fillAndSubmit('  maria@example.com ')

    expect(signInMock).toHaveBeenCalledWith('credentials', {
      name: 'maria@example.com',
      password: 'Secret@123',
      redirect: false,
    })
    expect(pushMock).toHaveBeenCalledWith('/')
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
