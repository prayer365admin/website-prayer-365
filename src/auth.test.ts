import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ loginUser: vi.fn(), getUserByEmail: vi.fn() }))

vi.mock('@/controller/authentication', () => ({ loginUser: m.loginUser }))
vi.mock('@/controller/user', () => ({ getUserByEmail: m.getUserByEmail }))

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

  it('ends the session when the user no longer exists', async () => {
    m.getUserByEmail.mockResolvedValue(null)

    const token = await authCallbacks.jwt({ token: { email: 'gone@example.com' } as never })

    expect(token).toBeNull()
  })
})
