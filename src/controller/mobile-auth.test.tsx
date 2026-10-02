// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CredentialsSignin } from 'next-auth'

vi.mock('@/controller/authentication', () => ({ loginUser: vi.fn() }))
vi.mock('next-auth', () => {
  class CredentialsSignin extends Error {
    code: string
    constructor() {
      super('Sign-in failed')
      this.code = 'CREDENTIALS_SIGNIN'
    }
  }
  return { CredentialsSignin }
})
vi.mock('@/providers/user', () => ({ GET_USER_BY_ID: vi.fn() }))
vi.mock('@/providers/mobile-auth', () => ({
  CREATE_MOBILE_SESSION: vi.fn(),
  GET_MOBILE_SESSION_BY_HASH: vi.fn(),
  ROTATE_MOBILE_SESSION: vi.fn(),
  REVOKE_MOBILE_SESSION: vi.fn(),
  REVOKE_SESSION_FAMILY: vi.fn(),
}))
vi.mock('@/utils/jwt-token', () => ({
  hashRefreshToken: vi.fn((t: string) => `h:${t}`),
  randomRefreshToken: vi
    .fn()
    .mockReturnValueOnce('r1')
    .mockReturnValueOnce('r2')
    .mockReturnValueOnce('r3'),
  signMobileAccessToken: vi.fn().mockResolvedValue('accessT'),
}))
vi.mock('@/utils/db-connection', () => ({
  db: { $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb({})) },
}))

import { loginUser } from '@/controller/authentication'
import {
  CREATE_MOBILE_SESSION,
  GET_MOBILE_SESSION_BY_HASH,
  ROTATE_MOBILE_SESSION,
  REVOKE_MOBILE_SESSION,
  REVOKE_SESSION_FAMILY,
} from '@/providers/mobile-auth'
import { GET_USER_BY_ID } from '@/providers/user'
import { mobileLogin, mobileRefresh, mobileLogout } from '@/controller/mobile-auth'

const uid = 'u1'
const user = {
  id: uid,
  email: 'u@e.com',
  name: 'U',
  auth_version: 1,
  status: 'active',
  role: { id: 'rl', name: 'prayer_user' },
}
const session = (extra: Record<string, unknown> = {}) => ({
  id: 't1',
  user_id: uid,
  family_id: 'fam1',
  auth_version: 1,
  used_at: null,
  revoked_at: null,
  expires_at: new Date(Date.now() + 3600000),
  installation_id: 'inst1',
  token: 'h:r1',
  ...extra,
})

beforeEach(() => vi.clearAllMocks())

describe('mobileLogin', () => {
  it('issues access + refresh pair and persists hashed refresh', async () => {
    vi.mocked(loginUser).mockResolvedValue(user as never)
    const out = await mobileLogin({ email: 'u@e.com', password: 'pw', installationId: 'inst1' })
    expect(out).toMatchObject({ accessToken: 'accessT', refreshToken: 'r1', expiresIn: 900 })
    expect(out.user.authVersion).toBe(1)
    expect(CREATE_MOBILE_SESSION).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: uid, token_hash: 'h:r1', auth_version: 1 }),
    )
  })

  it('generic 401 on credential failure — identical to unknown email', async () => {
    vi.mocked(loginUser).mockRejectedValue(new (class extends CredentialsSignin {})())
    const attempt = () =>
      mobileLogin({ email: 'u@e.com', password: 'bad', installationId: 'inst1' })
    await expect(attempt).rejects.toMatchObject({ code: 401, error_code: 'UNAUTHORIZED' })
    expect(CREATE_MOBILE_SESSION).not.toHaveBeenCalled()
  })
})

describe('mobileRefresh', () => {
  it('rotates: marks presented used + issues new pair on same family', async () => {
    vi.mocked(GET_MOBILE_SESSION_BY_HASH).mockResolvedValue(session() as never)
    vi.mocked(GET_USER_BY_ID).mockResolvedValue(user as never)
    const out = await mobileRefresh({ refreshToken: 'r1', installationId: 'inst1' })
    expect(ROTATE_MOBILE_SESSION).toHaveBeenCalledWith(
      expect.objectContaining({ family_id: 'fam1', auth_version: 1, token_hash: 'h:r2' }),
    )
    expect(out.refreshToken).toBe('r2')
    expect(out.accessToken).toBe('accessT')
  })

  it('rejects an expired refresh token', async () => {
    vi.mocked(GET_MOBILE_SESSION_BY_HASH).mockResolvedValue(
      session({ expires_at: new Date(Date.now() - 1000) }) as never,
    )
    await expect(
      mobileRefresh({ refreshToken: 'r1', installationId: 'inst1' }),
    ).rejects.toMatchObject({ code: 401 })
    expect(ROTATE_MOBILE_SESSION).not.toHaveBeenCalled()
  })

  it('rejects unknown hash', async () => {
    vi.mocked(GET_MOBILE_SESSION_BY_HASH).mockResolvedValue(null)
    await expect(
      mobileRefresh({ refreshToken: 'nope', installationId: 'inst1' }),
    ).rejects.toMatchObject({ code: 401 })
  })

  it('reuse detection: already-used token revokes whole family + 401', async () => {
    vi.mocked(GET_MOBILE_SESSION_BY_HASH).mockResolvedValue(
      session({ used_at: new Date() }) as never,
    )
    await expect(
      mobileRefresh({ refreshToken: 'r1', installationId: 'inst1' }),
    ).rejects.toMatchObject({ code: 401 })
    expect(REVOKE_SESSION_FAMILY).toHaveBeenCalledWith({ family_id: 'fam1' })
    expect(ROTATE_MOBILE_SESSION).not.toHaveBeenCalled()
  })

  it('auth_version bump revokes family (password change)', async () => {
    vi.mocked(GET_MOBILE_SESSION_BY_HASH).mockResolvedValue(session({ auth_version: 1 }) as never)
    vi.mocked(GET_USER_BY_ID).mockResolvedValue({ ...user, auth_version: 2 } as never)
    await expect(
      mobileRefresh({ refreshToken: 'r1', installationId: 'inst1' }),
    ).rejects.toMatchObject({ code: 401 })
    expect(REVOKE_SESSION_FAMILY).toHaveBeenCalledWith({ family_id: 'fam1' })
  })

  it('disabled user revokes family + 401', async () => {
    vi.mocked(GET_MOBILE_SESSION_BY_HASH).mockResolvedValue(session() as never)
    vi.mocked(GET_USER_BY_ID).mockResolvedValue({ ...user, status: 'disabled' } as never)
    await expect(
      mobileRefresh({ refreshToken: 'r1', installationId: 'inst1' }),
    ).rejects.toMatchObject({ code: 401 })
    expect(REVOKE_SESSION_FAMILY).toHaveBeenCalled()
  })

  it('revoked refresh token → 401', async () => {
    vi.mocked(GET_MOBILE_SESSION_BY_HASH).mockResolvedValue(
      session({ revoked_at: new Date() }) as never,
    )
    await expect(
      mobileRefresh({ refreshToken: 'r1', installationId: 'inst1' }),
    ).rejects.toMatchObject({ code: 401 })
  })
})

describe('mobileLogout', () => {
  it('revokes the device session', async () => {
    vi.mocked(GET_MOBILE_SESSION_BY_HASH).mockResolvedValue(session() as never)
    await mobileLogout({ refreshToken: 'r1' })
    expect(REVOKE_MOBILE_SESSION).toHaveBeenCalledWith({ id: 't1' })
  })

  it('401 on unknown token', async () => {
    vi.mocked(GET_MOBILE_SESSION_BY_HASH).mockResolvedValue(null)
    await expect(mobileLogout({ refreshToken: 'nope' })).rejects.toMatchObject({ code: 401 })
  })
})
