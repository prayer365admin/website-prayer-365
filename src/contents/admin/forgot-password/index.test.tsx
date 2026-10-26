import { axiosMock, renderWithProviders } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsAdminForgotPassword from '.'

const renderPage = () => renderWithProviders(<ContentsAdminForgotPassword />)

const axiosError = (error_code: string, details = '') =>
  Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { data: { error_code, details } },
  })

const send = async (email = 'pastor.carter@gracechurchwestminster.org') => {
  await userEvent.type(screen.getByLabelText('Official Church / Staff Email'), email)
  await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
}

describe('Staff forgot password page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    axiosMock.post.mockReset()
  })

  it('renders header, encrypted pill, and heading', () => {
    renderPage()

    expect(screen.getByText('Prayer 365')).toBeTruthy()
    expect(screen.getByText('PORTAL AUTH')).toBeTruthy()
    expect(screen.queryByText('Encrypted 256-bit')).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Get back to your account' })).toBeTruthy()
    expect(screen.getByPlaceholderText('pastor.carter@gracechurchwestminster.org')).toBeTruthy()
    expect(
      screen.getByText(
        /Your prayer petitions, confessions, and church tithing remain private, encrypted, and pastorally guarded\./,
      ),
    ).toBeTruthy()
  })

  it('requires a valid email before sending', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Email is required')).toBeTruthy()
    expect(axiosMock.post).not.toHaveBeenCalled()
  })

  it('sends the email with trimmed address and replaces form with check your email', async () => {
    axiosMock.post.mockResolvedValue({ data: {} })
    renderPage()
    await send('  pastor.carter@gracechurchwestminster.org  ')

    expect(await screen.findByRole('heading', { level: 2, name: 'Check your email' })).toBeTruthy()
    expect(
      screen.getByText(
        'If your email is registered, a password reset link has been sent to your email address.',
      ),
    ).toBeTruthy()
    expect(axiosMock.post).toHaveBeenCalledWith('/api/v1/users/forgot-password', {
      email: 'pastor.carter@gracechurchwestminster.org',
    })
    expect(screen.getByRole('link', { name: /Back to Sign In/ }).getAttribute('href')).toBe(
      '/admin/login',
    )
    expect(screen.queryByLabelText('Official Church / Staff Email')).toBeNull()
  })

  it('shows cooldown button label when request returns RESET_TOO_EARLY', async () => {
    axiosMock.post.mockRejectedValueOnce(
      axiosError('RESET_TOO_EARLY', 'Please wait 30 seconds (remaining_seconds=30)!'),
    )
    renderPage()
    await send()

    expect(await screen.findByRole('button', { name: /Send again in 30s/ })).toBeTruthy()
  })

  it('shows error message on unexpected failure', async () => {
    axiosMock.post.mockRejectedValueOnce(new Error('network down'))
    renderPage()
    await send()

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Password reset failed. Please try again!',
      ),
    )
  })
})
