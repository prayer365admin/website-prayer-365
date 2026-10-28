// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({
  default: vi.fn(),
}))

vi.mock('@/providers/user', () => ({
  GET_USERS: vi.fn(),
}))

vi.mock('@/controller/user', () => ({
  createUser: vi.fn(),
}))

import { createUser } from '@/controller/user'
import { GET_USERS } from '@/providers/user'
import requiredAuth from '@/utils/required-auth'
import { GET, POST } from './route'

const makeAuth = (granted: boolean) => ({
  session: { user: { user_id: 'u1' } },
  permission: {
    readAny: () => ({ granted }),
    createAny: () => ({ granted }),
  },
})

describe('GET /api/v1/users', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns user list with 200 and total', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(true) as never)
    vi.mocked(GET_USERS).mockResolvedValue({
      result: [{ id: 'u1', email: 'a@b.com', name: 'A' }],
      total: 1,
    } as never)

    const res = (await GET(new NextRequest('http://localhost/api/v1/users?page=1&limit=10')))!
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, message: 'Successfully get all users', total: 1 })
    expect(body.result).toEqual([{ id: 'u1', email: 'a@b.com', name: 'A' }])
    expect(body.request_id).toBeTruthy()
  })

  it('checks prayer_administrator subject', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(true) as never)
    vi.mocked(GET_USERS).mockResolvedValue({ result: [], total: 0 } as never)

    await GET(new NextRequest('http://localhost/api/v1/users'))
    expect(vi.mocked(requiredAuth).mock.results[0]).toBeTruthy()
  })

  it('never returns password in list result', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(true) as never)
    vi.mocked(GET_USERS).mockResolvedValue({
      result: [{ id: 'u1', email: 'a@b.com', name: 'A', password: 'hash' }],
      total: 1,
    } as never)

    const res = (await GET(new NextRequest('http://localhost/api/v1/users')))!
    const body = await res.json()
    expect(body.result[0].password).toBeUndefined()
  })

  it('returns 403 NOT_ALLOWED when permission denied', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(false) as never)

    const res = (await GET(new NextRequest('http://localhost/api/v1/users')))!
    expect(res.status).toBe(403)
    expect((await res.json()).error_code).toBe('NOT_ALLOWED')
  })

  it('passes parsed search params to provider', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(true) as never)
    vi.mocked(GET_USERS).mockResolvedValue({ result: [], total: 0 } as never)

    await GET(
      new NextRequest(
        'http://localhost/api/v1/users?page=2&limit=25&search=jo&order_direction=asc',
      ),
    )
    expect(GET_USERS).toHaveBeenCalledWith({
      limit: 25,
      page: 2,
      order_by: 'created_at',
      order_direction: 'asc',
      search: 'jo',
    })
  })

  it('caps page size without capping the page number and rejects unsafe sort fields', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(true) as never)
    vi.mocked(GET_USERS).mockResolvedValue({ result: [], total: 0 } as never)

    const clamped = await GET(
      new NextRequest('http://localhost/api/v1/users?page=999999999999&limit=999999'),
    )
    expect(clamped?.status).toBe(200)
    expect(GET_USERS).toHaveBeenCalledWith(
      expect.objectContaining({ page: 999999999999, limit: 100 }),
    )

    const rejected = await GET(new NextRequest('http://localhost/api/v1/users?order_by=password'))
    expect(rejected?.status).toBe(400)
    expect((await rejected?.json()).error_code).toBe('INVALID_ORDER_BY')
  })
})

describe('POST /api/v1/users', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates user and returns 201 without role_id', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(true) as never)
    vi.mocked(createUser).mockResolvedValue({ id: 'u9', email: 'a@b.com', name: 'A' } as never)

    const req = new NextRequest('http://localhost/api/v1/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'A', password: 'Strong@123', email: 'a@b.com' }),
    })
    const res = (await POST(req!))!
    expect(res.status).toBe(201)
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'A', password: 'Strong@123', email: 'a@b.com' }),
    )
  })

  it('creates user with role_id binding and returns 201', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(true) as never)
    vi.mocked(createUser).mockResolvedValue({ id: 'u9', email: 'a@b.com', name: 'A' } as never)
    const req = new NextRequest('http://localhost/api/v1/users', {
      method: 'POST',
      body: JSON.stringify({
        name: 'A',
        password: 'Strong@123',
        email: 'a@b.com',
        role_id: 'r1',
      }),
    })
    const res = (await POST(req!))!
    expect(res.status).toBe(201)
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'A',
        password: 'Strong@123',
        email: 'a@b.com',
        role_id: 'r1',
      }),
    )
  })

  it('returns 422 when password missing', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(true) as never)
    const req = new NextRequest('http://localhost/api/v1/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'A', email: 'a@b.com' }),
    })
    const res = (await POST(req!))!
    expect(res.status).toBe(422)
  })

  it('returns 403 when permission denied', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(false) as never)
    const req = new NextRequest('http://localhost/api/v1/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'A', password: 'Strong@123', email: 'a@b.com' }),
    })
    const res = (await POST(req!))!
    expect(res.status).toBe(403)
  })

  it('forwards profile_asset_id so the uploaded avatar is actually saved', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(true) as never)
    vi.mocked(createUser).mockResolvedValue({ id: 'u9', email: 'a@b.com', name: 'A' } as never)

    const req = new NextRequest('http://localhost/api/v1/users', {
      method: 'POST',
      body: JSON.stringify({
        name: 'A',
        password: 'Strong@123',
        email: 'a@b.com',
        profile_asset_id: 'asset-1',
      }),
    })
    const res = (await POST(req!))!
    expect(res.status).toBe(201)
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ profile_asset_id: 'asset-1' }),
    )
  })
})
