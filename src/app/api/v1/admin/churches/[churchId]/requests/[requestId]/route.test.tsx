// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/controller/request', () => ({
  resolveRequestReadScope: vi.fn(),
  getRequestDetail: vi.fn(),
}))

import requiredAuth from '@/utils/required-auth'
import { resolveRequestReadScope, getRequestDetail } from '@/controller/request'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const churchParams = { params: Promise.resolve({ churchId: 'c1', requestId: 'r1' }) }
const scope = { churchIds: new Set(['c1']) }

const detail = {
  id: 'r1',
  kind: 'prayer',
  subject: 'S',
  message: 'M',
  classification: 'standard',
  contactMethod: 'phone',
  phone: '1',
  email: 'e',
  availability: 'mon',
  createdAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/v1/admin/churches/[churchId]/requests/:requestId', () => {
  it('returns authorized request details (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(resolveRequestReadScope).mockResolvedValue(scope as never)
    vi.mocked(getRequestDetail).mockResolvedValue(detail as never)
    const res = (await GET(new NextRequest('http://x/requests/r1'), churchParams as never))!
    expect(res.status).toBe(200)
    expect((await res.json()).result.id).toBe('r1')
  })

  it('returns 404 for an out-of-scope or private-to-caller row', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(resolveRequestReadScope).mockResolvedValue(scope as never)
    vi.mocked(getRequestDetail).mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'Request not found.',
      }),
    )
    const res = (await GET(new NextRequest('http://x/requests/r1'), churchParams as never))!
    expect(res.status).toBe(404)
  })

  it('returns 404 for a cross-church scope (existence hidden)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(resolveRequestReadScope).mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'nope',
      }),
    )
    const res = (await GET(new NextRequest('http://x/requests/r1'), churchParams as never))!
    expect(res.status).toBe(404)
    expect(getRequestDetail).not.toHaveBeenCalled()
  })

  it('returns 401 without authentication', async () => {
    vi.mocked(requiredAuth).mockRejectedValue(
      new GeneralError({
        code: 401,
        error: 'Not Authenticated!',
        error_code: 'UNAUTHORIZED',
        details: 'login',
      }),
    )
    const res = (await GET(new NextRequest('http://x/requests/r1'), churchParams as never))!
    expect(res.status).toBe(401)
  })
})
