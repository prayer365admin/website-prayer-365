import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/user', () => ({
  GET_USER_BY_ID: vi.fn(),
  GET_USER_BY_EMAIL: vi.fn(),
  CREATE_USER: vi.fn(),
  UPDATE_USER: vi.fn(),
  INCREMENT_AUTH_VERSION: vi.fn(),
}))

vi.mock('@/utils/hash', () => ({
  hashSecret: vi.fn(async ({ secret }: { secret: string }) => `hashed:${secret}`),
}))

import { createUser, getUserByEmail, getUserById, updateUser } from './user'
import {
  CREATE_USER,
  GET_USER_BY_EMAIL,
  GET_USER_BY_ID,
  INCREMENT_AUTH_VERSION,
  UPDATE_USER,
} from '@/providers/user'
import { hashSecret } from '@/utils/hash'

const mockUser = { id: 'u1', email: 'a@b.com', name: 'A', role_id: null }

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
