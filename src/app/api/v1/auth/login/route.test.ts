import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ loginUser: vi.fn(), signAccessToken: vi.fn() }))

vi.mock('@/controller/authentication', () => ({ loginUser: m.loginUser }))
vi.mock('@/utils/jwt-token', () => ({ signAccessToken: m.signAccessToken }))
vi.mock('next-auth', () => ({ CredentialsSignin: class extends Error {} }))

import { POST } from './route'

const req = () =>
  new NextRequest('http://localhost/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'a@b.c', password: 'secret123' }),
  })

describe('POST /api/v1/auth/login (staff-only token login, R-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.signAccessToken.mockResolvedValue('token')
  })

  it.each([
    ['prayer_user', { id: 'r9', name: 'prayer_user' }],
    ['no role', null],
  ])('rejects a customer (%s) with 401', async (_label, role) => {
    m.loginUser.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'A', role })

    const res = await POST(req())

    expect(res.status).toBe(401)
    expect(m.signAccessToken).not.toHaveBeenCalled()
  })

  it('issues a token for staff', async () => {
    m.loginUser.mockResolvedValue({
      id: 's1',
      email: 'a@b.c',
      name: 'A',
      role: { id: 'r1', name: 'prayer_administrator' },
    })

    const res = await POST(req())

    expect(res.status).toBe(200)
    expect((await res.json()).result.token).toBe('token')
  })
})
