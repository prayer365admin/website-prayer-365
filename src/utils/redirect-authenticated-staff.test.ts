import { beforeEach, describe, expect, it, vi } from 'vitest'
import redirectAuthenticatedStaff from './redirect-authenticated-staff'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))

describe('redirectAuthenticatedStaff', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    { id: 'admin-role', name: 'prayer_administrator' },
    { id: 'leader-role', name: 'prayer_group_leader' },
  ])('redirects an authenticated staff member with role %j to /dashboard', async (role) => {
    m.requiredWebAuth.mockResolvedValue({ session: { user: { role } } })

    await expect(redirectAuthenticatedStaff()).rejects.toThrow('REDIRECT /dashboard')
    expect(m.redirect).toHaveBeenCalledWith('/dashboard')
  })

  it('allows a guest with an invalid or stale session to use the staff login page', async () => {
    m.requiredWebAuth.mockRejectedValue(new Error('UNAUTHORIZED'))

    await expect(redirectAuthenticatedStaff()).resolves.toBeUndefined()
    expect(m.redirect).not.toHaveBeenCalled()
  })

  it.each([null, { id: 'customer-role', name: 'prayer_user' }])(
    'does not redirect a customer with role %j away from the staff login page',
    async (role) => {
      m.requiredWebAuth.mockResolvedValue({
        session: { user: { role } },
      })

      await expect(redirectAuthenticatedStaff()).resolves.toBeUndefined()
      expect(m.redirect).not.toHaveBeenCalled()
    },
  )
})
