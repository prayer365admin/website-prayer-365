// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({
  default: vi.fn(),
}))

vi.mock('@/controller/access', () => ({
  getEffectiveAccess: vi.fn(),
}))

import { getEffectiveAccess } from '@/controller/access'
import requiredAuth from '@/utils/required-auth'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

describe('GET /api/v1/admin/access', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns effective access with 200 for churchId', async () => {
    vi.mocked(requiredAuth).mockResolvedValue({
      session: { user: { user_id: 'u1' } },
    } as never)
    vi.mocked(getEffectiveAccess).mockResolvedValue({
      scope: { kind: 'church', orgNodeId: 'n1', name: 'St. Andrew' },
      subjects: { prayer_church: ['read', 'update'] },
    } as never)

    const res = (await GET(
      new NextRequest('http://localhost/api/v1/admin/access?churchId=church-1'),
    ))!
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.subjects).toEqual({ prayer_church: ['read', 'update'] })
    expect(body.request_id).toBeTruthy()
    expect(getEffectiveAccess).toHaveBeenCalledWith({
      userId: 'u1',
      churchId: 'church-1',
      regionId: undefined,
    })
  })

  it('passes regionId through when churchId absent', async () => {
    vi.mocked(requiredAuth).mockResolvedValue({
      session: { user: { user_id: 'u1' } },
    } as never)
    vi.mocked(getEffectiveAccess).mockResolvedValue({
      scope: { kind: 'diocese', orgNodeId: 'r1', name: 'Estonia' },
      subjects: {},
    } as never)

    await GET(new NextRequest('http://localhost/api/v1/admin/access?regionId=r1'))
    expect(getEffectiveAccess).toHaveBeenCalledWith({
      userId: 'u1',
      churchId: undefined,
      regionId: 'r1',
    })
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
    const res = (await GET(new NextRequest('http://localhost/api/v1/admin/access')))!
    expect(res.status).toBe(401)
  })

  it('returns 400 when mixed params', async () => {
    vi.mocked(requiredAuth).mockResolvedValue({
      session: { user: { user_id: 'u1' } },
    } as never)
    vi.mocked(getEffectiveAccess).mockRejectedValue(
      new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'SCOPE_AMBIGUOUS',
        details: 'Provide exactly one of churchId or regionId.',
      }),
    )

    const res = (await GET(
      new NextRequest('http://localhost/api/v1/admin/access?churchId=c1&regionId=r1'),
    ))!
    expect(res.status).toBe(400)
    expect((await res.json()).error_code).toBe('SCOPE_AMBIGUOUS')
  })
})
