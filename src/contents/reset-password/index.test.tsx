import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pushMock, renderWithProviders, searchParamsMock } from '@/test/frontend/render'
import ContentsResetPassword from './index'

describe('ContentsResetPassword', () => {
  beforeEach(() => {
    searchParamsMock.get.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    pushMock.mockClear()
  })

  it('shows invalid link when no token', () => {
    renderWithProviders(<ContentsResetPassword />)
    expect(screen.getByText('Invalid Reset Link')).toBeTruthy()
  })

  it('resets password and redirects to login', async () => {
    searchParamsMock.get.mockReturnValue('token123')
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as never
    const user = userEvent.setup()
    renderWithProviders(<ContentsResetPassword />)

    await user.type(screen.getByPlaceholderText('New Password'), 'Strong@123')
    await user.type(screen.getByPlaceholderText('Confirm New Password'), 'Strong@123')
    await user.click(screen.getByRole('button', { name: 'Reset Password' }))

    expect(await screen.findByText('Password Changed!')).toBeTruthy()
    expect(pushMock).toHaveBeenCalledWith('/login')
  })
})
