import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/user', () => ({
  GET_USER_BY_ID: vi.fn(),
  GET_USER_BY_EMAIL: vi.fn(),
  CREATE_USER: vi.fn(),
  COUNT_ACTIVE_CUSTOMERS: vi.fn(),
  UPDATE_USER: vi.fn(),
  INCREMENT_AUTH_VERSION: vi.fn(),
  DEACTIVATE_USER: vi.fn(),
  COUNT_ACTIVE_ADMINS: vi.fn(),
}))

vi.mock('@/utils/hash', () => ({
  hashSecret: vi.fn(async ({ secret }: { secret: string }) => `hashed:${secret}`),
}))

vi.mock('@/providers/role-assignment', () => ({
  GET_ACTIVE_ASSIGNMENT: vi.fn(),
  GET_ROLE_BY_KEY: vi.fn(),
}))

vi.mock('@/providers/scope', () => ({
  GET_GLOBAL_ORG_NODE: vi.fn(),
}))

vi.mock('./role-assignment', () => ({
  createRoleAssignment: vi.fn(),
}))

vi.mock('@/utils/db-transaction', () => ({
  dbTransaction: (fn: (tx: unknown) => unknown) => fn({ auditLog: { create: vi.fn() } }),
}))

import {
  createUser,
  deactivateUser,
  getFellowshipMemberCount,
  getUserByEmail,
  getUserById,
  updateUser,
} from './user'
import {
  COUNT_ACTIVE_ADMINS,
  COUNT_ACTIVE_CUSTOMERS,
  CREATE_USER,
  DEACTIVATE_USER,
  GET_USER_BY_EMAIL,
  GET_USER_BY_ID,
  INCREMENT_AUTH_VERSION,
  UPDATE_USER,
} from '@/providers/user'
import { GET_ACTIVE_ASSIGNMENT, GET_ROLE_BY_KEY } from '@/providers/role-assignment'
import { GET_GLOBAL_ORG_NODE } from '@/providers/scope'
import { createRoleAssignment } from './role-assignment'
import { hashSecret } from '@/utils/hash'

const mockUser = { id: 'u1', email: 'a@b.com', name: 'A', role_id: null }

it('returns the public fellowship member count', async () => {
  vi.mocked(COUNT_ACTIVE_CUSTOMERS).mockResolvedValue(37)
  await expect(getFellowshipMemberCount()).resolves.toBe(37)
})

describe('getUserById', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 400 when no user_id', async () => {
    await expect(getUserById({ user_id: '' })).rejects.toMatchObject({
      code: 400,
      error_code: 'INVALID_USER_ID',
    })
  })

  it('throws 404 when provider returns nothing', async () => {
    vi.mocked(GET_USER_BY_ID).mockResolvedValue(null as never)
    await expect(getUserById({ user_id: 'x' })).rejects.toMatchObject({
      code: 404,
      error_code: 'USER_NOT_FOUND',
    })
  })

  it('returns user from provider', async () => {
    vi.mocked(GET_USER_BY_ID).mockResolvedValue(mockUser as never)
    await expect(getUserById({ user_id: 'u1' })).resolves.toBe(mockUser)
  })
})

describe('getUserByEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 400 when no email', async () => {
    await expect(getUserByEmail({ email: '' })).rejects.toMatchObject({
      code: 400,
      error_code: 'INVALID_USER_EMAIL',
    })
  })

  it('throws 404 when user missing', async () => {
    vi.mocked(GET_USER_BY_EMAIL).mockResolvedValue(null as never)
    await expect(getUserByEmail({ email: 'nope@x.com' })).rejects.toMatchObject({ code: 404 })
  })

  it('returns user', async () => {
    vi.mocked(GET_USER_BY_EMAIL).mockResolvedValue(mockUser as never)
    await expect(getUserByEmail({ email: 'a@b.com' })).resolves.toBe(mockUser)
  })
})

describe('createUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('binds role_id when provided (single-role identity binding)', async () => {
    await createUser({ email: 'a@b.com', name: 'A', password: 'Strong@123', role_id: 'r1' })
    expect(CREATE_USER).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'a@b.com',
        name: 'A',
        password: 'hashed:Strong@123',
        role_id: 'r1',
      }),
    )
  })

  it('throws 400 when password missing', async () => {
    await expect(
      createUser({ email: 'a@b.com', name: 'A', password: '', role_id: undefined }),
    ).rejects.toMatchObject({
      code: 400,
      error_code: 'INVALID_PASSWORD',
    })
  })

  it('hashes password and creates user with email_verified_at set', async () => {
    await createUser({ email: 'a@b.com', name: 'A', password: 'pass1234', role_id: undefined })
    expect(hashSecret).toHaveBeenCalledWith({ secret: 'pass1234' })
    expect(CREATE_USER).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'a@b.com',
        name: 'A',
        password: 'hashed:pass1234',
        email_verified_at: expect.any(Date),
      }),
    )
  })
})

describe('updateUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes role_id through on update (single-role identity binding)', async () => {
    await updateUser({ user_id: 'u1', payload: { name: 'B', role_id: 'r1' } as never })
    expect(UPDATE_USER).toHaveBeenCalledWith({
      user_id: 'u1',
      payload: { name: 'B', role_id: 'r1' },
    })
  })

  it('hashes password when provided', async () => {
    await updateUser({ user_id: 'u1', payload: { password: 'newpass123' } })
    expect(UPDATE_USER).toHaveBeenCalledWith({
      user_id: 'u1',
      payload: { password: 'hashed:newpass123' },
    })
  })

  it('bumps auth_version when password changes (invalidates mobile tokens)', async () => {
    await updateUser({ user_id: 'u1', payload: { password: 'newpass123' } })
    expect(INCREMENT_AUTH_VERSION).toHaveBeenCalledWith({ user_id: 'u1' })
  })

  it('does not bump auth_version when password unchanged', async () => {
    await updateUser({ user_id: 'u1', payload: { name: 'B' } })
    expect(INCREMENT_AUTH_VERSION).not.toHaveBeenCalled()
  })

  it('drops password key when not provided', async () => {
    await updateUser({ user_id: 'u1', payload: { name: 'B' } })
    expect(UPDATE_USER).toHaveBeenCalledWith({ user_id: 'u1', payload: { name: 'B' } })
  })
})

describe('super-admin scope assignment (tenancy layer)', () => {
  beforeEach(() => vi.clearAllMocks())

  const stubAdmin = (roleName = 'administrator', hasAssignment = false) => {
    vi.mocked(CREATE_USER).mockResolvedValue({ id: 'u1' } as never)
    vi.mocked(UPDATE_USER).mockResolvedValue({ id: 'u1' } as never)
    vi.mocked(GET_USER_BY_ID).mockResolvedValue({ id: 'u1', role: { name: roleName } } as never)
    vi.mocked(GET_GLOBAL_ORG_NODE).mockResolvedValue({ id: 'g1' } as never)
    vi.mocked(GET_ROLE_BY_KEY).mockResolvedValue({ id: 'r-admin' } as never)
    vi.mocked(GET_ACTIVE_ASSIGNMENT).mockResolvedValue(
      (hasAssignment ? { id: 'a1' } : null) as never,
    )
    vi.mocked(createRoleAssignment).mockResolvedValue({ id: 'a1' } as never)
  }

  it('creates the GLOBAL assignment when a user is created as administrator', async () => {
    stubAdmin()
    await createUser({
      email: 'a@b.com',
      name: 'A',
      password: 'Strong@123',
      role_id: 'r-admin',
      actorId: 'actor-1',
      requestId: 'req-1',
    })
    expect(createRoleAssignment).toHaveBeenCalledWith({
      payload: { userId: 'u1', roleKey: 'administrator', orgNodeId: 'g1' },
      actorId: 'actor-1',
      requestId: 'req-1',
    })
  })

  it('does not touch assignments for any other role', async () => {
    stubAdmin('prayer_church_admin')
    await createUser({ email: 'a@b.com', name: 'A', password: 'Strong@123', role_id: 'r2' })
    expect(createRoleAssignment).not.toHaveBeenCalled()
  })

  it('is idempotent: an existing GLOBAL assignment is left alone', async () => {
    stubAdmin('administrator', true)
    await createUser({ email: 'a@b.com', name: 'A', password: 'Strong@123', role_id: 'r-admin' })
    expect(createRoleAssignment).not.toHaveBeenCalled()
  })

  it('never fails user creation when the assignment cannot be created', async () => {
    stubAdmin()
    vi.mocked(createRoleAssignment).mockRejectedValue(
      Object.assign(new Error('escalation denied'), { error_code: 'ESCALATION_DENIED' }),
    )
    await expect(
      createUser({ email: 'a@b.com', name: 'A', password: 'Strong@123', role_id: 'r-admin' }),
    ).resolves.toMatchObject({ id: 'u1' })
  })

  it('reconciles the assignment when a user is promoted to administrator', async () => {
    stubAdmin()
    await updateUser({
      user_id: 'u1',
      payload: { role_id: 'r-admin' } as never,
      actorId: 'actor-1',
      requestId: 'req-2',
    })
    expect(createRoleAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ userId: 'u1' }) }),
    )
  })

  it('skips the assignment path when the update does not change the role', async () => {
    stubAdmin()
    await updateUser({ user_id: 'u1', payload: { name: 'B' } })
    expect(GET_USER_BY_ID).not.toHaveBeenCalled()
    expect(createRoleAssignment).not.toHaveBeenCalled()
  })
})

describe('deactivateUser (soft delete)', () => {
  beforeEach(() => vi.clearAllMocks())

  const activeUser = {
    id: 'u2',
    status: 'active',
    deleted_at: null,
    role: { name: 'prayer_pastor' },
  }

  it('sets status inactive, bumps auth_version and audits', async () => {
    vi.mocked(GET_USER_BY_ID).mockResolvedValue(activeUser as never)
    vi.mocked(DEACTIVATE_USER).mockResolvedValue({ id: 'u2', status: 'inactive' } as never)
    vi.mocked(INCREMENT_AUTH_VERSION).mockResolvedValue({ id: 'u2' } as never)

    await deactivateUser({ user_id: 'u2', actorId: 'u1', requestId: 'req' })

    expect(DEACTIVATE_USER).toHaveBeenCalledWith({ user_id: 'u2' }, expect.anything())
    expect(INCREMENT_AUTH_VERSION).toHaveBeenCalledWith({ user_id: 'u2' }, expect.anything())
  })

  it('refuses to deactivate your own account', async () => {
    vi.mocked(GET_USER_BY_ID).mockResolvedValue(activeUser as never)
    await expect(
      deactivateUser({ user_id: 'u1', actorId: 'u1', requestId: 'req' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'CANNOT_DEACTIVATE_SELF' })
  })

  it('refuses an already inactive account', async () => {
    vi.mocked(GET_USER_BY_ID).mockResolvedValue({ ...activeUser, status: 'inactive' } as never)
    await expect(
      deactivateUser({ user_id: 'u2', actorId: 'u1', requestId: 'req' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'ALREADY_INACTIVE' })
  })

  it('refuses to remove the last active super admin', async () => {
    vi.mocked(GET_USER_BY_ID).mockResolvedValue({
      ...activeUser,
      role: { name: 'administrator' },
    } as never)
    vi.mocked(COUNT_ACTIVE_ADMINS).mockResolvedValue(0)

    await expect(
      deactivateUser({ user_id: 'u2', actorId: 'u1', requestId: 'req' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'LAST_ADMIN' })
  })

  it('deactivates a super admin while another one stays active', async () => {
    vi.mocked(GET_USER_BY_ID).mockResolvedValue({
      ...activeUser,
      role: { name: 'administrator' },
    } as never)
    vi.mocked(COUNT_ACTIVE_ADMINS).mockResolvedValue(1)
    vi.mocked(DEACTIVATE_USER).mockResolvedValue({ id: 'u2' } as never)
    vi.mocked(INCREMENT_AUTH_VERSION).mockResolvedValue({ id: 'u2' } as never)

    await deactivateUser({ user_id: 'u2', actorId: 'u1', requestId: 'req' })
    expect(DEACTIVATE_USER).toHaveBeenCalled()
  })

  it('404s an unknown user', async () => {
    vi.mocked(GET_USER_BY_ID).mockResolvedValue(null as never)
    await expect(
      deactivateUser({ user_id: 'nope', actorId: 'u1', requestId: 'req' }),
    ).rejects.toMatchObject({ code: 404, error_code: 'USER_NOT_FOUND' })
  })
})
