import { beforeEach, describe, expect, it, vi } from 'vitest'

const tx = vi.hoisted(() => ({
  role: { findUnique: vi.fn() },
  church: { findFirst: vi.fn() },
  user: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  userChurch: { create: vi.fn() },
  oAuthAccount: { create: vi.fn(), findUnique: vi.fn() },
}))
const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  user: { count: vi.fn(), findMany: vi.fn() },
}))

vi.mock('@/utils/db-connection', () => ({ db }))

import { CREATE_CUSTOMER, FIND_OR_CREATE_OAUTH_CUSTOMER, GET_CUSTOMERS, GET_USERS } from './user'

const payload = {
  email: 'maria@example.com',
  name: 'Maria',
  password: 'hashed',
  locale: 'et',
  main_church_id: 'c1',
  role_name: 'prayer_user',
}

describe('CREATE_CUSTOMER (WB1 signup)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))
    tx.role.findUnique.mockResolvedValue({ id: 'r-user' })
    tx.church.findFirst.mockResolvedValue({ id: 'c1' })
    tx.user.create.mockResolvedValue({ id: 'u1', email: payload.email, name: 'Maria' })
  })

  it('creates the user with role + locale and its single main church inside one transaction', async () => {
    const result = await CREATE_CUSTOMER(payload)

    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.church.findFirst).toHaveBeenCalledWith({
      where: { id: 'c1', status: 'APPROVED' },
      select: { id: true },
    })
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        email: payload.email,
        name: 'Maria',
        password: 'hashed',
        locale: 'et',
        role_id: 'r-user',
      },
      omit: { password: true },
    })
    expect(tx.userChurch.create).toHaveBeenCalledWith({
      data: { user_id: 'u1', church_id: 'c1', is_main: true, is_followed: true },
    })
    expect(result.user?.id).toBe('u1')
  })

  it('creates nothing when the role is not seeded', async () => {
    tx.role.findUnique.mockResolvedValue(null)

    expect(await CREATE_CUSTOMER(payload)).toEqual({
      role: null,
      user: null,
      churchNotFound: false,
    })
    expect(tx.user.create).not.toHaveBeenCalled()
  })

  it('creates nothing when the main church is not APPROVED', async () => {
    tx.church.findFirst.mockResolvedValue(null)

    const result = await CREATE_CUSTOMER(payload)

    expect(result.churchNotFound).toBe(true)
    expect(tx.user.create).not.toHaveBeenCalled()
    expect(tx.userChurch.create).not.toHaveBeenCalled()
  })

  it('without a main church: creates the user only, no church lookup or row', async () => {
    const result = await CREATE_CUSTOMER({ ...payload, main_church_id: null })

    expect(result.user?.id).toBe('u1')
    expect(tx.church.findFirst).not.toHaveBeenCalled()
    expect(tx.userChurch.create).not.toHaveBeenCalled()
  })
})

describe('staff vs customer lists (R-01/R-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Array form of $transaction: resolve each query.
    db.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops))
    db.user.count.mockResolvedValue(0)
    db.user.findMany.mockResolvedValue([])
  })

  it('staff list excludes the prayer_user customer role (and role-less users)', async () => {
    await GET_USERS({ limit: 10, page: 1 })

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: { is: { name: { not: 'prayer_user' } } } },
      }),
    )
  })

  it('customer list = no role OR prayer_user, combined with the search', async () => {
    await GET_CUSTOMERS({ limit: 10, page: 1, search: 'maria' })

    const where = db.user.findMany.mock.calls[0][0].where
    expect(where.AND[0]).toEqual({
      OR: [{ role_id: null }, { role: { is: { name: 'prayer_user' } } }],
    })
    expect(where.AND[1].OR.length).toBeGreaterThan(0)
  })
})

describe('FIND_OR_CREATE_OAUTH_CUSTOMER', () => {
  const input = {
    provider: 'google',
    providerAccountId: 'google-123',
    email: 'maria@example.com',
    name: 'Maria',
    profilePicture: 'https://example.com/maria.png',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    db.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))
    tx.oAuthAccount.findUnique.mockResolvedValue(null)
    tx.role.findUnique.mockResolvedValue({ id: 'r-user' })
  })

  it('creates a verified customer and links the Google subject', async () => {
    tx.user.findUnique.mockResolvedValue(null)
    tx.user.create.mockResolvedValue({
      id: 'u1',
      ...input,
      role: { id: 'r-user', name: 'prayer_user', permission: [] },
      status: 'active',
      auth_version: 1,
    })

    const result = await FIND_OR_CREATE_OAUTH_CUSTOMER(input)

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: input.email,
          password: null,
          email_verified_at: expect.any(Date),
          role_id: 'r-user',
        }),
      }),
    )
    expect(tx.oAuthAccount.create).toHaveBeenCalledWith({
      data: {
        user_id: 'u1',
        provider: 'google',
        provider_account_id: 'google-123',
      },
    })
    expect(result?.id).toBe('u1')
  })

  it('links an existing customer with the same verified email', async () => {
    const existing = {
      id: 'u1',
      email: input.email,
      name: 'Maria',
      status: 'active',
      role: null,
      email_verified_at: null,
      profile_picture: null,
    }
    tx.user.findUnique.mockResolvedValue(existing)
    tx.user.update.mockResolvedValue({ ...existing, email_verified_at: new Date() })

    await FIND_OR_CREATE_OAUTH_CUSTOMER(input)

    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ email_verified_at: expect.any(Date) }),
      }),
    )
    expect(tx.oAuthAccount.create).toHaveBeenCalled()
  })

  it('does not link a staff account through customer Google login', async () => {
    tx.user.findUnique.mockResolvedValue({
      id: 'staff-1',
      email: input.email,
      status: 'active',
      role: { name: 'prayer_administrator' },
    })

    expect(await FIND_OR_CREATE_OAUTH_CUSTOMER(input)).toBeNull()
    expect(tx.oAuthAccount.create).not.toHaveBeenCalled()
  })
})
