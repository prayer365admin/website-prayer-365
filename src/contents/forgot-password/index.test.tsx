import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'
import ContentsForgotPassword from './index'

describe('ContentsForgotPassword', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows success result after sending a reset link', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as never
    const user = userEvent.setup()
    renderWithProviders(<ContentsForgotPassword />)
    await user.type(screen.getByPlaceholderText('Email'), 'a@x.com')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))
    expect(await screen.findByText('Check your email!')).toBeTruthy()
  })

  it('shows an error notification when the request fails', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, json: async () => ({ details: 'bad' }) }) as never
    const user = userEvent.setup()
    renderWithProviders(<ContentsForgotPassword />)
    await user.type(screen.getByPlaceholderText('Email'), 'a@x.com')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))
    expect(await screen.findByText('Request Failed!')).toBeTruthy()
  })
})
