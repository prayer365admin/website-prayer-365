import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, searchParamsMock } from '@/test/frontend/render'
import ContentsVerifyEmail from './index'

describe('ContentsVerifyEmail', () => {
  beforeEach(() => {
    searchParamsMock.get.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('verifies email and shows congratulations', async () => {
    searchParamsMock.get.mockReturnValue('tok123')
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as never
    const user = userEvent.setup()
    renderWithProviders(<ContentsVerifyEmail />)

    await user.click(screen.getByRole('button', { name: 'Confirm Email' }))
    expect(await screen.findByText('Congratulations!')).toBeTruthy()
  })

  it('shows invalid link error when no token', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsVerifyEmail />)
    await user.click(screen.getByRole('button', { name: 'Confirm Email' }))
    expect(await screen.findByText('Invalid Link!')).toBeTruthy()
  })
})
