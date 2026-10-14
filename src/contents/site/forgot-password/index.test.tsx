import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { axiosMock, renderWithProviders } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsSiteForgotPassword from '.'

const en = SITE_MESSAGES.en

const renderPage = () =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteForgotPassword locale="en" />
    </SiteI18nProvider>,
  )

const axiosError = (error_code: string, details = '') =>
  Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { data: { error_code, details } },
  })

const send = async (email = 'maria@example.com') => {
  await userEvent.type(screen.getByLabelText(en.signUpEmailLabel), email)
  await userEvent.click(screen.getByRole('button', { name: en.forgotSubmit }))
}

describe('Forgot password (W04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    axiosMock.post.mockReset()
  })

  it('is the sign-in card with its own title, the quote, and no aside', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: en.forgotTitle })).toBeTruthy()
    expect(screen.getByText(en.signInQuote)).toBeTruthy()
    expect(screen.queryByText(en.sealTitle)).toBeNull()
  })

  it('requires a valid email before sending', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: en.forgotSubmit }))

    expect(await screen.findByText(en.signUpErrorEmail)).toBeTruthy()
    expect(axiosMock.post).not.toHaveBeenCalled()
  })

  it('sends the email and replaces the form with "check your email"', async () => {
    axiosMock.post.mockResolvedValue({ data: {} })
    renderPage()
    await send()

    expect(await screen.findByText(en.forgotSentTitle)).toBeTruthy()
    expect(axiosMock.post).toHaveBeenCalledWith('/api/v1/users/forgot-password', {
      email: 'maria@example.com',
    })
    expect(screen.queryByLabelText(en.signUpEmailLabel)).toBeNull()
  })

  it('a request inside the cooldown counts down instead of failing', async () => {
    axiosMock.post.mockRejectedValueOnce(
      axiosError('RESET_TOO_EARLY', 'Please wait 30 seconds (remaining_seconds=30)!'),
    )
    renderPage()
    await send()

    expect(await screen.findByRole('button', { name: /Send again in 30s/ })).toBeTruthy()
  })

  it('shows the general error on an unexpected failure', async () => {
    axiosMock.post.mockRejectedValueOnce(new Error('network down'))
    renderPage()
    await send()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(en.error))
  })
})
