import { axiosMock, renderWithProviders, searchParamsMock } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsAdminResetPassword from '.'

const renderPage = () => renderWithProviders(<ContentsAdminResetPassword />)

const axiosError = (error_code: string) =>
  Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { data: { error_code } },
  })

const fill = async (password = 'NewPass1!', confirm = 'NewPass1!') => {
  await userEvent.type(screen.getByLabelText('New password'), password)
  await userEvent.type(screen.getByLabelText('Re-enter password'), confirm)
  await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))
}

describe('Staff reset password page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    axiosMock.post.mockReset()
    searchParamsMock.get.mockImplementation((k: string) => (k === 'token' ? 'tok-staff-123' : null))
  })

  it('shows the card with header, encrypted pill, and both password fields', () => {
    renderPage()

    expect(screen.getByText('Prayer 365')).toBeTruthy()
    expect(screen.getByText('PORTAL AUTH')).toBeTruthy()
    expect(screen.getByText('Encrypted 256-bit')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Reset your password' })).toBeTruthy()
    expect(screen.getByLabelText('New password')).toBeTruthy()
    expect(screen.getByLabelText('Re-enter password')).toBeTruthy()
    expect(screen.getByText(/This system is strictly restricted to authorized clergy/)).toBeTruthy()
  })

  it('blocks when passwords do not match', async () => {
    renderPage()
    await fill('NewPass1!', 'DifferentPass2!')

    expect(await screen.findByText('Passwords do not match')).toBeTruthy()
    expect(axiosMock.post).not.toHaveBeenCalled()
  })

  it('resets password with token and replaces form with success card', async () => {
    axiosMock.post.mockResolvedValue({ data: {} })
    renderPage()
    await fill()

    expect(screen.getByText('CONGRATULATION')).toBeTruthy()
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Password has been reset' }),
    ).toBeTruthy()
    expect(
      screen.getByText('You can now login to your account using the new password.'),
    ).toBeTruthy()
    expect(axiosMock.post).toHaveBeenCalledWith('/api/v1/auth/reset-password', {
      token: 'tok-staff-123',
      new_password: 'NewPass1!',
      confirm_password: 'NewPass1!',
    })
    expect(screen.getByRole('link', { name: /Login/ }).getAttribute('href')).toBe('/admin/login')
  })

  it('shows invalid state when token is invalid or expired', async () => {
    axiosMock.post.mockRejectedValueOnce(axiosError('INVALID_OR_EXPIRED_TOKEN'))
    renderPage()
    await fill()

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Reset link is invalid' }),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'This password reset link is invalid or has expired. Please request a new one.',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: /Request new link/ }).getAttribute('href')).toBe(
      '/admin/forgot-password',
    )
  })

  it('goes straight to invalid state when token is missing', () => {
    searchParamsMock.get.mockImplementation(() => null)
    renderPage()

    expect(screen.getByRole('heading', { level: 2, name: 'Reset link is invalid' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Request new link/ }).getAttribute('href')).toBe(
      '/admin/forgot-password',
    )
  })

  it('shows error alert on unexpected failure', async () => {
    axiosMock.post.mockRejectedValueOnce(new Error('network error'))
    renderPage()
    await fill()

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Password reset failed. Please try again!',
      ),
    )
  })
})
