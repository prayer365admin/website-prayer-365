import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'
import ContentsRegister from './index'

describe('ContentsRegister', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers and shows the verification success screen', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { email: 'new@x.com' } }),
    }) as never
    const user = userEvent.setup()
    renderWithProviders(<ContentsRegister />)

    await user.type(screen.getByPlaceholderText('Full Name'), 'Alice')
    await user.type(screen.getByPlaceholderText('Email'), 'new@x.com')
    await user.type(screen.getByPlaceholderText('Password'), 'Strong@123')
    await user.type(screen.getByPlaceholderText('Confirm Password'), 'Strong@123')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    expect(await screen.findByText('Check your email!')).toBeTruthy()
    expect(screen.getByText(/new@x.com/)).toBeTruthy()
  })

  it('shows error on USER_EXISTS', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error_code: 'USER_EXISTS', details: 'exists' }),
    }) as never
    const user = userEvent.setup()
    renderWithProviders(<ContentsRegister />)

    await user.type(screen.getByPlaceholderText('Full Name'), 'Alice')
    await user.type(screen.getByPlaceholderText('Email'), 'old@x.com')
    await user.type(screen.getByPlaceholderText('Password'), 'Strong@123')
    await user.type(screen.getByPlaceholderText('Confirm Password'), 'Strong@123')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    expect(await screen.findByText('Registration Failed!')).toBeTruthy()
  })
})
