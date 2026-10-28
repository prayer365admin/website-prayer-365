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

describe('Staff forgot password route', () => {
  it('calls guest guard and renders the designed staff forgot-password page', async () => {
    renderWithProviders(await Page())

    expect(redirectAuthenticatedStaff).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { level: 2, name: 'Get back to your account' })).toBeTruthy()
    expect(screen.getByPlaceholderText('pastor.carter@gracechurchwestminster.org')).toBeTruthy()
  })
})
