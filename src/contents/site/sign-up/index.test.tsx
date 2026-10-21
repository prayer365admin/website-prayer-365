import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { axiosMock, pushMock, renderWithProviders, signInMock } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsSiteSignUp from '.'

const en = SITE_MESSAGES.en

const renderPage = () =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteSignUp locale="en" />
    </SiteI18nProvider>,
  )

const submit = () =>
  userEvent.click(screen.getByRole('button', { name: new RegExp(en.signUpSubmit) }))

const fill = async (password = 'Password1!') => {
  await userEvent.type(screen.getByLabelText(en.signUpNameLabel), ' Maria Lindqvist ')
  await userEvent.type(screen.getByLabelText(en.signUpEmailLabel), 'maria@example.com')
  await userEvent.type(screen.getByLabelText(en.signUpPasswordLabel), password)
}

const axiosError = (error_code: string) =>
  Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { data: { error_code } },
  })

const created = {
  data: {
    result: {
      id: 'u1',
      email: 'maria@example.com',
      name: 'Maria',
      verification_email_sent: true,
    },
  },
}

describe('Customer sign-up (W02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    axiosMock.post.mockReset()
    signInMock.mockResolvedValue({ error: undefined, code: undefined })
  })

  it('shows the identity form with the aside and footer', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: en.signUpTitle })).toBeTruthy()
    expect(screen.getByText(en.journeyTitle)).toBeTruthy()
    expect(screen.getByRole('link', { name: en.signUpSignIn }).getAttribute('href')).toBe('/login')
    // Language and parish are onboarding steps (R-06), not part of sign-up.
    expect(screen.queryByText(en.signUpStep2Title)).toBeNull()
    expect(screen.queryByText(en.signUpLanguageLabel)).toBeNull()
  })

  it('blocks on empty fields', async () => {
    renderPage()
    await submit()

    expect(await screen.findByText(en.signUpErrorName)).toBeTruthy()
    expect(axiosMock.post).not.toHaveBeenCalled()
  })

  it('keeps Apple unavailable and starts Google registration into customer setup', async () => {
    renderPage()

    expect(screen.getByRole('button', { name: en.signUpApple })).toHaveProperty('disabled', true)
    await userEvent.click(screen.getByRole('button', { name: en.signUpGoogle }))

    expect(signInMock).toHaveBeenCalledWith('google', { redirectTo: '/customer/setup' })
  })

  it('rejects a password shorter than 8 characters', async () => {
    renderPage()
    await fill('short')
    await submit()

    expect(await screen.findByText(en.signUpErrorPassword)).toBeTruthy()
    expect(axiosMock.post).not.toHaveBeenCalled()
  })

  it('sends name, email and password only, then shows "check your email"', async () => {
    axiosMock.post.mockResolvedValue(created)
    renderPage()
    await fill()
    await submit()

    expect(await screen.findByText(en.signUpSuccessTitle)).toBeTruthy()
    expect(axiosMock.post).toHaveBeenCalledTimes(1)
    expect(axiosMock.post).toHaveBeenCalledWith('/api/v1/auth/signup', {
      full_name: 'Maria Lindqvist',
      email: 'maria@example.com',
      password: 'Password1!',
      confirm_password: 'Password1!',
    })

    await userEvent.click(screen.getByRole('button', { name: en.signUpSuccessAction }))
    expect(pushMock).toHaveBeenCalledWith('/login')
  })

  it('opens resend verification when account creation succeeds but mail delivery fails', async () => {
    axiosMock.post.mockResolvedValue({
      data: { result: { ...created.data.result, verification_email_sent: false } },
    })
    renderPage()
    await fill()
    await submit()

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('/verify-account?email=maria%40example.com'),
    )
    expect(screen.queryByText(en.signUpSuccessTitle)).toBeNull()
  })

  it('locks the fields while the account is being created', async () => {
    let resolve!: (v: unknown) => void
    axiosMock.post.mockReturnValue(new Promise((r) => (resolve = r)))
    renderPage()
    await fill()
    await submit()

    await waitFor(() =>
      expect(screen.getByLabelText(en.signUpEmailLabel)).toHaveProperty('disabled', true),
    )
    expect(screen.getByLabelText(en.signUpNameLabel)).toHaveProperty('disabled', true)

    resolve(created)
    expect(await screen.findByText(en.signUpSuccessTitle)).toBeTruthy()
  })

  it('a taken email shows the error on the email field', async () => {
    axiosMock.post.mockRejectedValueOnce(axiosError('USER_EXISTS'))
    renderPage()
    await fill()
    await submit()

    expect(await screen.findByText(en.signUpErrorExists)).toBeTruthy()
  })

  it('shows a general error when signup fails without a field', async () => {
    axiosMock.post.mockRejectedValueOnce(new Error('network down'))
    renderPage()
    await fill()
    await submit()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(en.error))
  })
})
