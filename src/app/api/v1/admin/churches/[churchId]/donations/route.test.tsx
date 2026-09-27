// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/donation', () => ({ listDonations: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { listDonations } from '@/controller/donation'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const scope = () => ({
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
})
const params = { params: Promise.resolve({ churchId: 'c1' }) }
const row = {
  id: 'd1',
  amountMinor: '1000',
  currency: 'USD',
  paidAt: '2026-09-05T00:00:00.000Z',
  ref: 'pi_1',
}

describe('GET /api/v1/admin/churches/[churchId]/donations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns paginated donation rows (200) with the expected envelope', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope() as never)
    vi.mocked(listDonations).mockResolvedValue({ result: [row], total: 1 } as never)

    const res = (await GET(
      new NextRequest(
        'http://localhost/api/v1/admin/churches/c1/donations?from=2026-09-01&to=2026-09-30',
      ),
      params as never,
    ))!
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.total).toBe(1)
    expect(body.request_id).toBeTruthy()
    expect(body.result[0]).toEqual(row)
    expect(requiredScope).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c1', subject: 'prayer_donation', action: 'read' }),
    )
  })

  it('returns 403 when scope is denied', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'Not allowed.',
      }),
    )
    const res = (await GET(
      new NextRequest('http://localhost/api/v1/admin/churches/c1/donations'),
      params as never,
    ))!
    expect(res.status).toBe(403)
  })

  it('returns 404 for an unknown/out-of-scope church', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'Resource not found.',
      }),
    )
    const res = (await GET(
      new NextRequest('http://localhost/api/v1/admin/churches/ghost/donations'),
      params as never,
    ))!
    expect(res.status).toBe(404)
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
    const res = (await GET(
      new NextRequest('http://localhost/api/v1/admin/churches/c1/donations'),
      params as never,
    ))!
    expect(res.status).toBe(401)
  })
})
