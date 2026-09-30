import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, searchParamsMock } from '@/test/frontend/render'
import ContentsVerifyAccount from './index'

describe('ContentsVerifyAccount', () => {
  beforeEach(() => {
    searchParamsMock.get.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends a verification email and shows success', async () => {
    searchParamsMock.get.mockReturnValue('me@x.com')
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { cooldown_seconds: 90 } }),
    }) as never
    const user = userEvent.setup()
    renderWithProviders(<ContentsVerifyAccount />)

    await user.click(screen.getByRole('button', { name: 'Verify Now' }))
    expect(await screen.findByText('Email Sent!')).toBeTruthy()
  })

  it('shows a warning when resend is too early', async () => {
    searchParamsMock.get.mockReturnValue('me@x.com')
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error_code: 'RESEND_TOO_EARLY', details: 'remaining_seconds=90' }),
    }) as never
    const user = userEvent.setup()
    renderWithProviders(<ContentsVerifyAccount />)

    await user.click(screen.getByRole('button', { name: 'Verify Now' }))
    expect(await screen.findByText('Please Wait')).toBeTruthy()
  })
})
