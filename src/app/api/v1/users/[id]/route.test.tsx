// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({
  default: vi.fn(),
}))

vi.mock('@/providers/user', () => ({
  GET_USER_BY_ID: vi.fn(),
  DELETE_USER: vi.fn(),
}))

vi.mock('@/controller/user', () => ({
  updateUser: vi.fn(),
}))

import { updateUser } from '@/controller/user'
import { DELETE_USER, GET_USER_BY_ID } from '@/providers/user'
import requiredAuth from '@/utils/required-auth'
import { DELETE, GET, PUT } from './route'

const makeAuth = (opts: { ownId?: boolean; any?: boolean } = {}) => ({
  session: { user: { user_id: 'u1' } },
  permission: {
    read: () => ({ granted: opts.ownId === true || opts.any === true }),
    update: () => ({ granted: opts.ownId === true || opts.any === true }),
    delete: () => ({ granted: opts.ownId === true || opts.any === true }),
    readAny: () => ({ granted: opts.any === true }),
    updateAny: () => ({ granted: opts.any === true }),
    deleteAny: () => ({ granted: opts.any === true }),
  },
})

const params = { params: Promise.resolve({ id: 'u1' }) }

describe('GET /api/v1/users/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns user when own record', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth({ ownId: true }) as never)
    vi.mocked(GET_USER_BY_ID).mockResolvedValue({ id: 'u1', email: 'a@b.com' } as never)

    const res = (await GET(new NextRequest('http://localhost/api/v1/users/u1'), params as never))!
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, result: { id: 'u1' } })
  })

  it('returns user when admin readAny', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth({ any: true }) as never)
    vi.mocked(GET_USER_BY_ID).mockResolvedValue({ id: 'u9' } as never)

    const res = (await GET(new NextRequest('http://localhost/api/v1/users/u9'), params as never))!
    expect(res.status).toBe(200)
    expect(GET_USER_BY_ID).toHaveBeenCalledWith({ user_id: 'u1' })
  })

  it('returns 403 when neither own record nor admin', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth() as never)
    const res = (await GET(new NextRequest('http://localhost/api/v1/users/u1'), params as never))!
    expect(res.status).toBe(403)
    expect((await res.json()).error_code).toBe('NOT_ALLOWED')
  })
})

describe('PUT /api/v1/users/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates own record with hashed password via controller', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth({ ownId: true }) as never)
    vi.mocked(updateUser).mockResolvedValue({ id: 'u1' } as never)

    const req = new NextRequest('http://localhost/api/v1/users/u1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'B' }),
    })
    const res = (await PUT(req, params as never))!
    expect(res.status).toBe(200)
    expect(updateUser).toHaveBeenCalledWith({ user_id: 'u1', payload: { name: 'B' } })
  })

  it('returns 403 without permission', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth() as never)
    const req = new NextRequest('http://localhost/api/v1/users/u1', {
      method: 'PUT',
      body: JSON.stringify({}),
    })
    const res = (await PUT(req, params as never))!
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/v1/users/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes own record', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth({ ownId: true }) as never)
    vi.mocked(DELETE_USER).mockResolvedValue({ id: 'u1' } as never)

    const res = (await DELETE(
      new NextRequest('http://localhost/api/v1/users/u1'),
      params as never,
    ))!
    expect(res.status).toBe(200)
    expect(DELETE_USER).toHaveBeenCalledWith({ user_id: 'u1' })
  })

  it('returns 403 without permission', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth() as never)
    const res = (await DELETE(
      new NextRequest('http://localhost/api/v1/users/u1'),
      params as never,
    ))!
    expect(res.status).toBe(403)
  })
})
