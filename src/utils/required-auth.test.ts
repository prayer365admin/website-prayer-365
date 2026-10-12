import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralError } from './general-error'

const m = vi.hoisted(() => ({ auth: vi.fn(), can: vi.fn() }))

vi.mock('@/auth', () => ({ auth: m.auth }))
vi.mock('./access-permission', () => ({ getAccessPermission: async () => ({ can: m.can }) }))

import requiredAuth from './required-auth'

describe('requiredAuth with a role-less (customer) session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.can.mockReturnValue({ readAny: () => ({ granted: false }) })
  })

  it('rejects a missing session with 401', async () => {
    m.auth.mockResolvedValue(null)

    await expect(requiredAuth()).rejects.toBeInstanceOf(GeneralError)
  })

  it('does not crash and grants nothing to a role-less session', async () => {
    m.auth.mockResolvedValue({ user: { user_id: 'c1', role: null } })

    const { permission } = await requiredAuth()

    expect(m.can).toHaveBeenCalledWith('')
    expect(permission.readAny('prayer_administrator').granted).toBe(false)
  })
})
