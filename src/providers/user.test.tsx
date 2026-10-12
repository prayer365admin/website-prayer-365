import { beforeEach, describe, expect, it, vi } from 'vitest'

const tx = vi.hoisted(() => ({
  role: { findUnique: vi.fn() },
  church: { findFirst: vi.fn() },
  user: { create: vi.fn() },
  userChurch: { create: vi.fn() },
}))
const db = vi.hoisted(() => ({ $transaction: vi.fn() }))

vi.mock('@/utils/db-connection', () => ({ db }))

import { CREATE_CUSTOMER } from './user'

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

    expect(await CREATE_CUSTOMER(payload)).toEqual({ role: null, church: null, user: null })
    expect(tx.user.create).not.toHaveBeenCalled()
  })

  it('creates nothing when the main church is not APPROVED', async () => {
    tx.church.findFirst.mockResolvedValue(null)

    const result = await CREATE_CUSTOMER(payload)

    expect(result.church).toBeNull()
    expect(tx.user.create).not.toHaveBeenCalled()
    expect(tx.userChurch.create).not.toHaveBeenCalled()
  })
})
