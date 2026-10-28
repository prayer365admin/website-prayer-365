import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Page from './page'

const { redirectAuthenticatedStaff } = vi.hoisted(() => ({
  redirectAuthenticatedStaff: vi.fn(),
}))

vi.mock('@/utils/redirect-authenticated-staff', () => ({
  default: redirectAuthenticatedStaff,
}))

describe('Staff login route', () => {
  it('calls guest guard and renders the designed staff sign-in page', async () => {
    renderWithProviders(await Page())

    expect(redirectAuthenticatedStaff).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Sign In to Your Workspace' }),
    ).toBeTruthy()
    expect(screen.getByPlaceholderText('pastor.carter@gracechurchwestminster.org')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sign In to Church Workspace/i })).toBeTruthy()
  })
})
