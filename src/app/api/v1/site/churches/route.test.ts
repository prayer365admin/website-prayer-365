import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  listPublicChurches: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('@/controller/mobile', () => ({ listPublicChurches: m.listPublicChurches }))

import { GET } from './route'

describe('GET /api/v1/site/churches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.requiredWebAuth.mockResolvedValue({ session: { user: { user_id: 'u1' } }, user: {} })
  })

  it('returns 401 when website authentication fails', async () => {
    m.requiredWebAuth.mockRejectedValue(
      new GeneralError({
        code: 401,
        error: 'Not Authenticated!',
        error_code: 'UNAUTHORIZED',
        details: 'Please login and try again!',
      }),
    )

    const res = await GET(new NextRequest('http://localhost/api/v1/site/churches'))

    expect(res.status).toBe(401)
  })

  it('returns 200 with results and pagination matching the query', async () => {
    const summary = {
      id: 'c1',
      name: 'Grace',
      denomination: 'Lutheran',
      city: 'Tallinn',
      coverAssetId: null,
      coverUrl: null,
      distanceKm: null,
    }
    m.listPublicChurches.mockResolvedValue({ result: [summary], total: 1 })

    const res = await GET(
      new NextRequest('http://localhost/api/v1/site/churches?search=grace&page=2&limit=24'),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(m.listPublicChurches).toHaveBeenCalledWith({
      query: expect.objectContaining({ search: 'grace', page: 2, limit: 24 }),
    })
    expect(body.success).toBe(true)
    expect(body.result).toEqual([summary])
    expect(body.total).toBe(1)
    expect(body.page).toBe(2)
    expect(body.limit).toBe(24)
    expect(typeof body.request_id).toBe('string')
  })

  it('passes default query parameters when no search params are provided', async () => {
    m.listPublicChurches.mockResolvedValue({ result: [], total: 0 })

    const res = await GET(new NextRequest('http://localhost/api/v1/site/churches'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(m.listPublicChurches).toHaveBeenCalledWith({
      query: { page: 1, limit: 25 },
    })
    expect(body.page).toBe(1)
    expect(body.limit).toBe(25)
  })

  it('returns 404 when the controller throws a not found GeneralError', async () => {
    m.listPublicChurches.mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'Not Found',
        error_code: 'NOT_FOUND',
        details: 'Churches not found',
      }),
    )

    const res = await GET(new NextRequest('http://localhost/api/v1/site/churches'))

    expect(res.status).toBe(404)
  })
})
