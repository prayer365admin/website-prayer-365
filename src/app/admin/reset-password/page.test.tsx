import { renderWithProviders, searchParamsMock } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Page from './page'

const { redirectAuthenticatedStaff } = vi.hoisted(() => ({
  redirectAuthenticatedStaff: vi.fn(),
}))

vi.mock('@/utils/redirect-authenticated-staff', () => ({
  default: redirectAuthenticatedStaff,
}))

describe('Staff reset password route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchParamsMock.get.mockImplementation((k: string) => (k === 'token' ? 'tok-staff-123' : null))
  })

  it('calls guest guard and renders the designed staff reset-password page', async () => {
    renderWithProviders(await Page())

    expect(redirectAuthenticatedStaff).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { level: 2, name: 'Reset your password' })).toBeTruthy()
    expect(screen.getByLabelText('New password')).toBeTruthy()
  })
})
