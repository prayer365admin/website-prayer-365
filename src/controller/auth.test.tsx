// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/controller/mail', () => ({ default: vi.fn() }))
vi.mock('@/controller/user', () => ({ updateUser: vi.fn() }))
vi.mock('@/utils/hash', () => ({ hashSecret: vi.fn().mockResolvedValue('hashed') }))
vi.mock('@/providers/auth-token', () => ({
  CREATE_AUTH_TOKEN: vi.fn().mockResolvedValue({ token: 'tok' }),
  COUNT_AUTH_TOKENS: vi.fn(),
  GET_LATEST_AUTH_TOKEN: vi.fn(),
  GET_VALID_AUTH_TOKEN: vi.fn(),
  USE_AUTH_TOKEN: vi.fn(),
}))
vi.mock('@/providers/user', () => ({
  CREATE_USER: vi.fn(),
  GET_USER_BY_EMAIL: vi.fn(),
  UPDATE_USER: vi.fn(),
}))

import { registerUser } from '@/controller/auth'
import { CREATE_USER, GET_USER_BY_EMAIL } from '@/providers/user'

const input = {
  full_name: ' Maria ',
  email: 'Maria@Example.com ',
  password: 'password1',
  baseUrl: 'http://localhost',
}

describe('registerUser (WB-18)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(GET_USER_BY_EMAIL).mockResolvedValue(null)
    vi.mocked(CREATE_USER).mockResolvedValue({
      id: 'u1',
      email: 'maria@example.com',
      name: 'Maria',
    } as never)
  })

  it('creates a role-less customer (role_id stays null) with a normalized email', async () => {
    const result = await registerUser(input)

    expect(CREATE_USER).toHaveBeenCalledWith({
      email: 'maria@example.com',
      name: 'Maria',
      password: 'hashed',
    })
    expect(vi.mocked(CREATE_USER).mock.calls[0][0]).not.toHaveProperty('role_id')
    expect(result).toEqual({ id: 'u1', email: 'maria@example.com', name: 'Maria' })
  })

  it('rejects a duplicate email with USER_EXISTS', async () => {
    vi.mocked(GET_USER_BY_EMAIL).mockResolvedValue({ id: 'u0' } as never)

    await expect(registerUser(input)).rejects.toMatchObject({ error_code: 'USER_EXISTS' })
    expect(CREATE_USER).not.toHaveBeenCalled()
  })
})
