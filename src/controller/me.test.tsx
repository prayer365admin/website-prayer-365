import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/user', () => ({
  GET_ME: vi.fn(),
}))

import { getMe } from './me'
import { GET_ME } from '@/providers/user'

const mockMe = {
  id: 'u1',
  email: 'admin@catatia.org',
  name: 'Admin',
  scopes: [{ kind: 'church', orgNodeId: 'n1', name: 'St. Andrew' }],
}

describe('getMe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns safe identity + scopes', async () => {
    vi.mocked(GET_ME).mockResolvedValue(mockMe as never)
    await expect(getMe({ user_id: 'u1' })).resolves.toEqual(mockMe)
    expect(GET_ME).toHaveBeenCalledWith({ user_id: 'u1' })
  })

  it('throws 400 when no user_id', async () => {
    await expect(getMe({ user_id: '' })).rejects.toMatchObject({
      code: 400,
      error_code: 'INVALID_USER_ID',
    })
  })

  it('throws 404 when provider returns nothing', async () => {
    vi.mocked(GET_ME).mockResolvedValue(null as never)
    await expect(getMe({ user_id: 'x' })).rejects.toMatchObject({
      code: 404,
      error_code: 'USER_NOT_FOUND',
    })
  })

  it('never exposes password/token fields in result', async () => {
    vi.mocked(GET_ME).mockResolvedValue(mockMe as never)
    const out = await getMe({ user_id: 'u1' })
    expect(out).not.toHaveProperty('password')
    expect(out).not.toHaveProperty('token')
    expect(out).not.toHaveProperty('auth_token')
  })
})
