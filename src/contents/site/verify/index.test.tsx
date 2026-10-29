import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { axiosMock, renderWithProviders, searchParamsMock } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsSiteVerify from '.'

const en = SITE_MESSAGES.en

const renderPage = (mode: 'confirm' | 'pending') =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteVerify locale="en" mode={mode} />
    </SiteI18nProvider>,
  )

const params = (values: Record<string, string>) =>
  searchParamsMock.get.mockImplementation((key: string) => values[key] ?? null)

const axiosError = (error_code: string, details = '') =>
  Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { data: { error_code, details } },
  })

describe('Verify email — /verify-email (W03 confirm)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    axiosMock.post.mockReset()
  })

  it('verifies only when the user presses Confirm, then offers sign in', async () => {
    params({ token: 'tok' })
    axiosMock.post.mockResolvedValue({ data: {} })
    renderPage('confirm')

    expect(axiosMock.post).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: en.verifyConfirm }))

    expect(await screen.findByText(en.verifySuccessTitle)).toBeTruthy()
    expect(axiosMock.post).toHaveBeenCalledWith('/api/v1/auth/verify-email', { token: 'tok' })
    expect(screen.getByRole('link', { name: en.recoveryLogin }).getAttribute('href')).toBe('/login')
  })

  it('an invalid or expired link shows the resend form', async () => {
    params({ token: 'old' })
    axiosMock.post.mockRejectedValueOnce(axiosError('INVALID_OR_EXPIRED'))
    renderPage('confirm')
    await userEvent.click(screen.getByRole('button', { name: en.verifyConfirm }))

    expect(await screen.findByText(en.verifyInvalidTitle)).toBeTruthy()
    expect(screen.getByRole('button', { name: en.resendSubmit })).toBeTruthy()
  })

  it('a link without a token goes straight to the resend form', () => {
    params({})
    renderPage('confirm')

    expect(screen.getByText(en.verifyInvalidTitle)).toBeTruthy()
  })

  it('a network failure shows the general error and keeps Confirm', async () => {
    params({ token: 'tok' })
    axiosMock.post.mockRejectedValueOnce(new Error('network down'))
    renderPage('confirm')
    await userEvent.click(screen.getByRole('button', { name: en.verifyConfirm }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(en.error))
    expect(screen.getByRole('button', { name: en.verifyConfirm })).toBeTruthy()
  })
})

describe('Verify email — /verify-account (W03 pending + resend)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    axiosMock.post.mockReset()
    params({ email: 'maria@example.com' })
  })

  it('prefills the email from sign-in', () => {
    renderPage('pending')

    expect(screen.getByText(en.verifyPendingTitle)).toBeTruthy()
    expect((screen.getByLabelText(en.signUpEmailLabel) as HTMLInputElement).value).toBe(
      'maria@example.com',
    )
  })

  it('sends a new link, shows the soft notice and starts the cooldown', async () => {
    axiosMock.post.mockResolvedValue({ data: { result: { cooldown_seconds: 90 } } })
    renderPage('pending')
    await userEvent.click(screen.getByRole('button', { name: en.resendSubmit }))

    expect(await screen.findByText(en.resendSent)).toBeTruthy()
    expect(axiosMock.post).toHaveBeenCalledWith('/api/v1/auth/resend-verification', {
      email: 'maria@example.com',
    })
    const button = screen.getByRole('button', { name: /Send again in 90s/ })
    expect(button).toHaveProperty('disabled', true)
  })

  it('"too early" counts down the remaining seconds from the server', async () => {
    axiosMock.post.mockRejectedValueOnce(
      axiosError('RESEND_TOO_EARLY', 'Please wait 42 seconds (remaining_seconds=42)!'),
    )
    renderPage('pending')
    await userEvent.click(screen.getByRole('button', { name: en.resendSubmit }))

    expect(await screen.findByRole('button', { name: /Send again in 42s/ })).toBeTruthy()
  })

  it('an already verified email points to sign in', async () => {
    axiosMock.post.mockRejectedValueOnce(axiosError('ALREADY_VERIFIED'))
    renderPage('pending')
    await userEvent.click(screen.getByRole('button', { name: en.resendSubmit }))

    expect(await screen.findByText(en.resendAlreadyVerified)).toBeTruthy()
  })
})
