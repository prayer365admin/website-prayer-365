import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({ requiredWebAuth: vi.fn() }))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))

import requiredCustomer from './required-customer'

const sessionFor = (role: { id: string; name: string } | null) => ({
  session: { user: { user_id: 'u1', role } },
  user: { id: 'u1' },
})

describe('requiredCustomer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes a role-less legacy customer through', async () => {
    m.requiredWebAuth.mockResolvedValue(sessionFor(null))
    await expect(requiredCustomer()).resolves.toMatchObject({ user: { id: 'u1' } })
  })

  it('passes the prayer_user customer role through', async () => {
    m.requiredWebAuth.mockResolvedValue(sessionFor({ id: 'r1', name: 'prayer_user' }))
    await expect(requiredCustomer()).resolves.toBeTruthy()
  })

  it.each([['administrator'], ['prayer_church_admin'], ['prayer_pastor']])(
    'refuses a staff session (%s) with 403 STAFF_ACCOUNT',
    async (roleName) => {
      m.requiredWebAuth.mockResolvedValue(sessionFor({ id: 'r1', name: roleName }))

      await expect(requiredCustomer()).rejects.toMatchObject({
        code: 403,
        error_code: 'STAFF_ACCOUNT',
      })
    },
  )

  it('propagates the 401 from the session guard', async () => {
    m.requiredWebAuth.mockRejectedValue(
      new GeneralError({
        code: 401,
        error: 'Not Authenticated!',
        error_code: 'UNAUTHORIZED',
        details: 'Please login and try again!',
      }),
    )

    await expect(requiredCustomer()).rejects.toMatchObject({ code: 401 })
  })
})
