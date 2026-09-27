// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({
  default: vi.fn(),
}))

vi.mock('@/controller/me', () => ({
  getMe: vi.fn(),
}))

import { getMe } from '@/controller/me'
import requiredAuth from '@/utils/required-auth'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

describe('GET /api/v1/admin/me', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns safe identity + request_id with 200', async () => {
    vi.mocked(requiredAuth).mockResolvedValue({
      session: { user: { user_id: 'u1' } },
    } as never)
    vi.mocked(getMe).mockResolvedValue({
      id: 'u1',
      email: 'admin@catatia.org',
      name: 'Admin',
      scopes: [{ kind: 'church', orgNodeId: 'n1', name: 'St. Andrew' }],
    } as never)

    const res = (await GET(new NextRequest('http://localhost/api/v1/admin/me')))!
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.request_id).toBeTruthy()
    expect(body.result).toMatchObject({ id: 'u1', email: 'admin@catatia.org' })
  })

  it('does not include password/token in result', async () => {
    vi.mocked(requiredAuth).mockResolvedValue({
      session: { user: { user_id: 'u1' } },
    } as never)
    vi.mocked(getMe).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      scopes: [],
    } as never)

    const res = (await GET(new NextRequest('http://localhost/api/v1/admin/me')))!
    const body = await res.json()
    expect(body.result.password).toBeUndefined()
    expect(body.result.token).toBeUndefined()
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requiredAuth).mockRejectedValue(
      new GeneralError({
        code: 401,
        error: 'Not Authenticated!',
        error_code: 'UNAUTHORIZED',
        details: 'Please login and try again!',
      }),
    )

    const res = (await GET(new NextRequest('http://localhost/api/v1/admin/me')))!
    expect(res.status).toBe(401)
    expect((await res.json()).error_code).toBe('UNAUTHORIZED')
  })

  it('returns 404 when user missing', async () => {
    vi.mocked(requiredAuth).mockResolvedValue({
      session: { user: { user_id: 'nope' } },
    } as never)
    vi.mocked(getMe).mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'USER_NOT_FOUND',
        details: 'User not found.',
      }),
    )

    const res = (await GET(new NextRequest('http://localhost/api/v1/admin/me')))!
    expect(res.status).toBe(404)
  })
})
