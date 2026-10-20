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

describe('Forgot password route page', () => {
  it('renders the forgot-password card in the cookie language', async () => {
    cookies.mockResolvedValue({ get: () => ({ value: 'sv' }) })

    renderWithProviders(await Page())

    expect(redirectAuthenticatedCustomer).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('heading', { level: 1, name: SITE_MESSAGES.sv.forgotTitle }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: SITE_MESSAGES.sv.forgotSubmit })).toBeTruthy()
  })
})
