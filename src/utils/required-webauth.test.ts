import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralError } from './general-error'

const m = vi.hoisted(() => ({ auth: vi.fn(), getUserById: vi.fn() }))

vi.mock('@/auth', () => ({ auth: m.auth }))
vi.mock('@/providers/user', () => ({ GET_USER_BY_ID: m.getUserById }))

import requiredWebAuth from './required-webauth'

const session = { user: { user_id: 'u1', auth_version: 1, role: null } }

describe('requiredWebAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.auth.mockResolvedValue(session)
    m.getUserById.mockResolvedValue({ id: 'u1', status: 'active', auth_version: 1 })
  })

  it('rejects a request with no cookie session', async () => {
    m.auth.mockResolvedValue(null)

    await expect(requiredWebAuth()).rejects.toBeInstanceOf(GeneralError)
  })

  it('rejects an inactive user', async () => {
    m.getUserById.mockResolvedValue({ id: 'u1', status: 'suspended', auth_version: 1 })

    await expect(requiredWebAuth()).rejects.toBeInstanceOf(GeneralError)
  })

  it('rejects a stale auth_version (password change / forced logout)', async () => {
    m.getUserById.mockResolvedValue({ id: 'u1', status: 'active', auth_version: 2 })

    await expect(requiredWebAuth()).rejects.toBeInstanceOf(GeneralError)
  })

  it('returns the session and no permission object for an active customer', async () => {
    const result = await requiredWebAuth()

    expect(result.session).toBe(session)
    expect(Object.keys(result)).toEqual(['session', 'user'])
  })
})
