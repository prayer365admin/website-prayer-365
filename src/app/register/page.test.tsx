import { SITE_MESSAGES } from '@/i18n/messages'
import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Page from './page'

const { cookies, getRegionalSanctuaryStats, redirectAuthenticatedCustomer } = vi.hoisted(() => ({
  cookies: vi.fn(),
  getRegionalSanctuaryStats: vi.fn(),
  redirectAuthenticatedCustomer: vi.fn(),
}))
vi.mock('next/headers', () => ({ cookies }))
vi.mock('@/controller/regional-sanctuary-stats', () => ({ getRegionalSanctuaryStats }))
vi.mock('@/utils/redirect-authenticated-customer', () => ({
  default: redirectAuthenticatedCustomer,
}))

describe('Register route page', () => {
  it('renders the customer sign-up wizard in the cookie language', async () => {
    cookies.mockResolvedValue({ get: () => ({ value: 'fi' }) })
    getRegionalSanctuaryStats.mockResolvedValue({
      approvedChurches: 12,
      dioceses: 3,
      publishedPrayers: 4812,
    })

    renderWithProviders(await Page())

    expect(redirectAuthenticatedCustomer).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('heading', { level: 1, name: SITE_MESSAGES.fi.signUpTitle }),
    ).toBeTruthy()
    expect(screen.getByLabelText(SITE_MESSAGES.fi.signUpNameLabel)).toBeTruthy()
    expect(screen.getByText('12 seurakuntaa')).toBeTruthy()
    expect(screen.getByText(/4\s812/)).toBeTruthy()
  })
})
