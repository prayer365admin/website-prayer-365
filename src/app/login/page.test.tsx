import { SITE_MESSAGES } from '@/i18n/messages'
import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Page from './page'

const { cookies, redirectAuthenticatedCustomer } = vi.hoisted(() => ({
  cookies: vi.fn(),
  redirectAuthenticatedCustomer: vi.fn(),
}))
vi.mock('next/headers', () => ({ cookies }))
vi.mock('@/utils/redirect-authenticated-customer', () => ({
  default: redirectAuthenticatedCustomer,
}))

describe('Customer login route', () => {
  it('renders the customer sign-in screen in the cookie language', async () => {
    cookies.mockResolvedValue({ get: () => ({ value: 'et' }) })

    renderWithProviders(await Page())

    expect(redirectAuthenticatedCustomer).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('heading', { level: 1, name: SITE_MESSAGES.et.signInTitle }),
    ).toBeTruthy()
    expect(screen.getByLabelText(SITE_MESSAGES.et.signInIdentifierLabel)).toBeTruthy()
  })
})
