import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  loginUser: vi.fn(),
  loginGoogleCustomer: vi.fn(),
  getOAuthUser: vi.fn(),
  getUserByEmail: vi.fn(),
  recordLogin: vi.fn(),
}))

vi.mock('@/controller/authentication', () => ({
  loginUser: m.loginUser,
  loginGoogleCustomer: m.loginGoogleCustomer,
  getOAuthUser: m.getOAuthUser,
}))
vi.mock('@/controller/user', () => ({ getUserByEmail: m.getUserByEmail }))
vi.mock('./providers/user', () => ({ RECORD_LOGIN: m.recordLogin }))

// The real NextAuth init pulls in `next/server`, which vitest (jsdom) cannot
// resolve. Mock it so we can unit-test the branch helpers in isolation.
vi.mock('next-auth', () => ({
  __esModule: true,
  default: () => ({ handlers: {}, signIn: {}, signOut: {}, auth: {} }),
}))
vi.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: () => ({}),
}))
vi.mock('next-auth/providers/google', () => ({
  __esModule: true,
  default: {},
}))

import { authCallbacks, customerAuthorize } from './auth'

const customer = {
  id: 'c1',
  email: 'customer@example.com',
  name: 'Customer',
  auth_version: 1,
  role: null,
}

const staff = { ...customer, id: 's1', role: { id: 'r1', name: 'prayer_administrator' } }

describe('customer sign-in branch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a session for a role-less customer without inventing a role', async () => {
    m.loginUser.mockResolvedValue(customer)

    const user = await customerAuthorize({
      name: 'customer@example.com',
      password: 'Secret@123',
    })

    expect(user).toMatchObject({ user_id: 'c1', role: null, auth_version: 1 })
    expect(user?.role).toBeNull()
  })

  it('still signs staff in with their role', async () => {
    m.loginUser.mockResolvedValue(staff)

    const user = await customerAuthorize({ name: 'staff@example.com', password: 'Secret@123' })

    expect(user?.role).toEqual({ id: 'r1', name: 'prayer_administrator' })
  })

  it('keeps a role-less customer session in the jwt callback', async () => {
    m.getUserByEmail.mockResolvedValue(customer)

    const token = await authCallbacks.jwt({ token: { email: 'customer@example.com' } as never })

    expect(token?.user).toMatchObject({ user_id: 'c1', role: null, auth_version: 1 })
  })

  it('hydrates a credentials JWT by email even when Auth.js supplies an account id', async () => {
    m.getUserByEmail.mockResolvedValue(customer)

    const token = await authCallbacks.jwt({
      token: { email: 'customer@example.com' } as never,
      account: { provider: 'credentials', providerAccountId: 'c1' } as never,
    })

    expect(m.getUserByEmail).toHaveBeenCalledWith({ email: 'customer@example.com' })
    expect(m.getOAuthUser).not.toHaveBeenCalled()
    expect(token?.user).toMatchObject({ user_id: 'c1', role: null, auth_version: 1 })
  })

  it('ends the session when the user no longer exists', async () => {
    m.getUserByEmail.mockResolvedValue(null)

    const token = await authCallbacks.jwt({ token: { email: 'gone@example.com' } as never })

    expect(token).toBeNull()
  })

  it('creates or links a customer for a verified Google profile', async () => {
    m.loginGoogleCustomer.mockResolvedValue(customer)

    const allowed = await authCallbacks.signIn({
      account: { provider: 'google', providerAccountId: 'google-123' } as never,
      profile: {
        email: 'customer@example.com',
        email_verified: true,
        name: 'Customer',
        picture: 'https://example.com/avatar.png',
      },
    })

    expect(allowed).toBe(true)
    expect(m.loginGoogleCustomer).toHaveBeenCalledWith({
      providerAccountId: 'google-123',
      email: 'customer@example.com',
      name: 'Customer',
      profilePicture: 'https://example.com/avatar.png',
    })
    expect(m.recordLogin).toHaveBeenCalledWith({ user_id: 'c1', provider: 'google' })
  })

  it('rejects an unverified Google email', async () => {
    const allowed = await authCallbacks.signIn({
      account: { provider: 'google', providerAccountId: 'google-123' } as never,
      profile: { email: 'customer@example.com', email_verified: false },
    })

    expect(allowed).toBe(false)
    expect(m.loginGoogleCustomer).not.toHaveBeenCalled()
  })

  it('hydrates the initial Google JWT from the linked provider account', async () => {
    m.getOAuthUser.mockResolvedValue(customer)

    const token = await authCallbacks.jwt({
      token: { email: 'customer@example.com' } as never,
      account: { provider: 'google', providerAccountId: 'google-123' } as never,
    })

    expect(m.getOAuthUser).toHaveBeenCalledWith({
      provider: 'google',
      providerAccountId: 'google-123',
    })
    expect(token?.user).toMatchObject({ user_id: 'c1', role: null })
  })
})
