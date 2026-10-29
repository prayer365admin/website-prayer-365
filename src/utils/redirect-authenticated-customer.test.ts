import { beforeEach, describe, expect, it, vi } from 'vitest'
import redirectAuthenticatedCustomer from './redirect-authenticated-customer'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))

describe('redirectAuthenticatedCustomer', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([null, { id: 'customer-role', name: 'prayer_user' }])(
    'redirects an authenticated customer with role %j to the home page',
    async (role) => {
      m.requiredWebAuth.mockResolvedValue({ session: { user: { role } } })

      await expect(redirectAuthenticatedCustomer()).rejects.toThrow('REDIRECT /')
    },
  )

  it('allows a guest with an invalid or stale session to use auth pages', async () => {
    m.requiredWebAuth.mockRejectedValue(new Error('UNAUTHORIZED'))

    await expect(redirectAuthenticatedCustomer()).resolves.toBeUndefined()
    expect(m.redirect).not.toHaveBeenCalled()
  })

  it('does not treat an authenticated staff account as a customer', async () => {
    m.requiredWebAuth.mockResolvedValue({
      session: { user: { role: { id: 'admin-role', name: 'prayer_administrator' } } },
    })

    await expect(redirectAuthenticatedCustomer()).resolves.toBeUndefined()
    expect(m.redirect).not.toHaveBeenCalled()
  })
})
