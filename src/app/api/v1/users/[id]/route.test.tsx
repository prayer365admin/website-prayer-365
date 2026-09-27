// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({
  default: vi.fn(),
}))

vi.mock('@/providers/user', () => ({
  GET_USER_BY_ID: vi.fn(),
}))

vi.mock('@/controller/user', () => ({
  updateUser: vi.fn(),
}))

import { updateUser } from '@/controller/user'
import { GET_USER_BY_ID } from '@/providers/user'
import requiredAuth from '@/utils/required-auth'
import { GeneralError } from '@/utils/general-error'
import { GET, PUT } from './route'

const makeAuth = (granted: boolean) => ({
  session: { user: { user_id: 'u1' } },
  permission: {
    readAny: () => ({ granted }),
    updateAny: () => ({ granted }),
  },
})

const params = { params: Promise.resolve({ id: 'u1' }) }

describe('GET /api/v1/users/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns user detail when prayer_administrator readAny granted', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(true) as never)
    vi.mocked(GET_USER_BY_ID).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
    } as never)

    const res = (await GET(new NextRequest('http://localhost/api/v1/users/u1'), params as never))!
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result).toMatchObject({ id: 'u1', email: 'a@b.com' })
    expect(body.request_id).toBeTruthy()
  })

  it('never returns password in detail', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(true) as never)
    vi.mocked(GET_USER_BY_ID).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      password: 'hash',
    } as never)

    const res = (await GET(new NextRequest('http://localhost/api/v1/users/u1'), params as never))!
    const body = await res.json()
    expect(body.result.password).toBeUndefined()
  })

  it('returns 403 when permission denied', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(false) as never)
    const res = (await GET(new NextRequest('http://localhost/api/v1/users/u1'), params as never))!
    expect(res.status).toBe(403)
  })

  it('returns 404 when user missing', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(true) as never)
    vi.mocked(GET_USER_BY_ID).mockResolvedValue(null as never)
    const res = (await GET(new NextRequest('http://localhost/api/v1/users/u1'), params as never))!
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/v1/users/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates via controller when prayer_administrator updateAny granted', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(true) as never)
    vi.mocked(updateUser).mockResolvedValue({ id: 'u1', name: 'B' } as never)

    const req = new NextRequest('http://localhost/api/v1/users/u1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'B' }),
    })
    const res = (await PUT(req, params as never))!
    expect(res.status).toBe(200)
    expect(updateUser).toHaveBeenCalledWith({ user_id: 'u1', payload: { name: 'B' } })
  })

  it('rejects role_id on update (422 through controller)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(true) as never)
    vi.mocked(updateUser).mockRejectedValue(
      new GeneralError({
        code: 422,
        error: 'VALIDATION_ERROR',
        error_code: 'ROLE_ID_FORBIDDEN',
        details: 'role_id is not allowed; assign roles via role assignments.',
        fields: { role_id: 'Forbidden' },
      }),
    )

    const req = new NextRequest('http://localhost/api/v1/users/u1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'B', role_id: 'r1' }),
    })
    const res = (await PUT(req, params as never))!
    expect(res.status).toBe(422)
    expect((await res.json()).error_code).toBe('ROLE_ID_FORBIDDEN')
  })

  it('returns 403 without permission', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(false) as never)
    const req = new NextRequest('http://localhost/api/v1/users/u1', {
      method: 'PUT',
      body: JSON.stringify({}),
    })
    const res = (await PUT(req, params as never))!
    expect(res.status).toBe(403)
  })
})
