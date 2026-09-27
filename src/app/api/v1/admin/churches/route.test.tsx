// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/controller/church', () => ({ listChurches: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import { listChurches } from '@/controller/church'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

const auth = (userId = 'u1') => ({ session: { user: { user_id: userId } } })

describe('GET /api/v1/admin/churches', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the assigned church list (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(listChurches).mockResolvedValue({ result: [{ id: 'c1' }], total: 1 } as never)

    const res = (await GET(
      new NextRequest('http://localhost/api/v1/admin/churches?page=2&limit=10'),
    ))!
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result).toEqual([{ id: 'c1' }])
    expect(body.total).toBe(1)
    expect(body.page).toBe(2)
    expect(body.limit).toBe(10)
    expect(listChurches).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        query: expect.objectContaining({ page: 2, limit: 10 }),
      }),
    )
  })

  it('returns empty list when caller has no assigned churches', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(listChurches).mockResolvedValue({ result: [], total: 0 } as never)
    const res = (await GET(new NextRequest('http://localhost/api/v1/admin/churches')))!
    expect(res.status).toBe(200)
    expect((await res.json()).total).toBe(0)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requiredAuth).mockRejectedValue(
      new GeneralError({
        code: 401,
        error: 'Not Authenticated!',
        error_code: 'UNAUTHORIZED',
        details: 'Login required.',
      }),
    )
    const res = (await GET(new NextRequest('http://localhost/api/v1/admin/churches')))!
    expect(res.status).toBe(401)
  })

  it('returns 422 for an invalid order_by value', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    const res = (await GET(
      new NextRequest('http://localhost/api/v1/admin/churches?order_by=hack'),
    ))!
    expect(res.status).toBe(422)
    expect((await res.json()).error_code).toBe('VALIDATION_ERROR')
  })
})
