// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  verifySecret: vi.fn(),
  isLoginBlocked: vi.fn(),
  recordLoginFailure: vi.fn(),
  clearLoginFailures: vi.fn(),
}))

vi.mock('@/providers/user', () => ({
  FIND_OR_CREATE_OAUTH_CUSTOMER: vi.fn(),
  GET_USER_BY_EMAIL: m.getUserByEmail,
  GET_USER_BY_OAUTH_ACCOUNT: vi.fn(),
}))
vi.mock('@/utils/hash', () => ({ verifySecret: m.verifySecret }))
vi.mock('@/providers/auth-login-attempt', () => ({
  IS_LOGIN_BLOCKED: m.isLoginBlocked,
  RECORD_LOGIN_FAILURE: m.recordLoginFailure,
  CLEAR_LOGIN_FAILURES: m.clearLoginFailures,
}))
vi.mock('next-auth', () => ({
  CredentialsSignin: class extends Error {
    code = 'credentials'
  },
}))

import { loginUser } from './authentication'

const user = {
  id: 'u1',
  email: 'maria@example.com',
  password: 'hash',
  email_verified_at: new Date(),
  status: 'active',
}

const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: { code: string }) => error.code,
  )

describe('loginUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.verifySecret.mockResolvedValue(true)
    m.isLoginBlocked.mockResolvedValue(false)
  })

  it('normalizes the email before lookup', async () => {
    m.getUserByEmail.mockResolvedValue(user)

    await expect(loginUser({ email: ' Maria@Example.com ', password: 'secret' })).resolves.toBe(
      user,
    )
    expect(m.getUserByEmail).toHaveBeenCalledWith({ email: 'maria@example.com' })
  })

  it.each([
    ['unknown account', null],
    ['disabled account', { ...user, status: 'disabled' }],
    ['OAuth-only account', { ...user, password: null }],
  ])('returns the same public code for an %s', async (_label, found) => {
    m.getUserByEmail.mockResolvedValue(found)

    expect(await codeOf(loginUser({ email: user.email, password: 'secret' }))).toBe(
      'INVALID_CREDENTIALS',
    )
    expect(m.verifySecret).toHaveBeenCalledOnce()
  })

  it('returns the same public code for a wrong password', async () => {
    m.getUserByEmail.mockResolvedValue(user)
    m.verifySecret.mockResolvedValue(false)

    expect(await codeOf(loginUser({ email: user.email, password: 'wrong' }))).toBe(
      'INVALID_CREDENTIALS',
    )
    expect(m.recordLoginFailure).toHaveBeenCalledWith({ user_id: 'u1' })
  })

  it('rejects a valid password while the account is temporarily blocked', async () => {
    m.getUserByEmail.mockResolvedValue(user)
    m.isLoginBlocked.mockResolvedValue(true)

    expect(await codeOf(loginUser({ email: user.email, password: 'secret' }))).toBe(
      'INVALID_CREDENTIALS',
    )
    expect(m.clearLoginFailures).not.toHaveBeenCalled()
  })

  it('keeps the verification redirect code after valid credentials', async () => {
    m.getUserByEmail.mockResolvedValue({ ...user, email_verified_at: null })

    expect(await codeOf(loginUser({ email: user.email, password: 'secret' }))).toBe(
      'EMAIL_NOT_VERIFIED',
    )
  })
})
