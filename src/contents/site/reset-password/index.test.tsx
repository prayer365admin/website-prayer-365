import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { axiosMock, renderWithProviders, searchParamsMock } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsSiteResetPassword from '.'

const en = SITE_MESSAGES.en

const renderPage = () =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteResetPassword locale="en" />
    </SiteI18nProvider>,
  )

const axiosError = (error_code: string) =>
  Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { data: { error_code } },
  })

const fill = async (password = 'NewPass1!', confirm = 'NewPass1!') => {
  await userEvent.type(screen.getByLabelText(en.resetNewLabel), password)
  await userEvent.type(screen.getByLabelText(en.resetConfirmLabel), confirm)
  await userEvent.click(screen.getByRole('button', { name: en.resetSubmit }))
}

describe('Reset password (W04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    axiosMock.post.mockReset()
    searchParamsMock.get.mockImplementation((k: string) => (k === 'token' ? 'tok' : null))
  })

  it('shows the recovery card with both password fields and safeguards', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: en.resetTitle })).toBeTruthy()
    expect(screen.getByLabelText(en.resetNewLabel)).toBeTruthy()
    expect(screen.getByLabelText(en.resetConfirmLabel)).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.recoverySafeguardsTitle })).toBeTruthy()
  })

  it('blocks when the passwords do not match', async () => {
    renderPage()
    await fill('NewPass1!', 'Different1!')

    expect(await screen.findByText(en.resetMismatch)).toBeTruthy()
    expect(axiosMock.post).not.toHaveBeenCalled()
  })

  it('resets with the token and replaces the form with "password changed"', async () => {
    axiosMock.post.mockResolvedValue({ data: {} })
    renderPage()
    await fill()

    expect(await screen.findByText(en.resetDoneTitle)).toBeTruthy()
    expect(axiosMock.post).toHaveBeenCalledWith('/api/v1/auth/reset-password', {
      token: 'tok',
      new_password: 'NewPass1!',
      confirm_password: 'NewPass1!',
    })
    expect(screen.getByRole('link', { name: en.recoveryLogin }).getAttribute('href')).toBe('/login')
  })

  it('an invalid or expired link offers a new one', async () => {
    axiosMock.post.mockRejectedValueOnce(axiosError('INVALID_OR_EXPIRED_TOKEN'))
    renderPage()
    await fill()

    expect(await screen.findByText(en.resetInvalidTitle)).toBeTruthy()
    expect(screen.getByRole('link', { name: en.resetRequestNew }).getAttribute('href')).toBe(
      '/forgot-password',
    )
  })

  it('a link without a token goes straight to the invalid state', () => {
    searchParamsMock.get.mockImplementation(() => null)
    renderPage()

    expect(screen.getByText(en.resetInvalidTitle)).toBeTruthy()
  })

  it('shows the general error on an unexpected failure', async () => {
    axiosMock.post.mockRejectedValueOnce(new Error('network down'))
    renderPage()
    await fill()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(en.error))
  })
})
