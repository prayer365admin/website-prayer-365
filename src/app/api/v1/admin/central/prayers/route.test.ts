// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({
  requiredAuth: vi.fn(),
  requiredScope: vi.fn(),
  listCentralPrayers: vi.fn(),
}))

vi.mock('@/utils/required-auth', () => ({ default: m.requiredAuth }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: m.requiredScope }))
vi.mock('@/controller/prayer', () => ({ listCentralPrayers: m.listCentralPrayers }))

import { GET } from './route'

const req = (query = '') => new NextRequest(`http://localhost/api/v1/admin/central/prayers${query}`)

const denied = new GeneralError({
  code: 403,
  error: 'UNAUTHORIZED',
  error_code: 'NOT_ALLOWED',
  details: 'This account is not allowed for this action.',
})

describe('GET /api/v1/admin/central/prayers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.requiredAuth.mockResolvedValue({ session: { user: { user_id: 'u1' } } })
    m.requiredScope.mockResolvedValue({ churchIds: new Set(['c1', 'c2']) })
    m.listCentralPrayers.mockResolvedValue({
      result: [
        {
          id: 'p1',
          churchId: 'c1',
          churchName: 'Parish One',
          version: 1,
          createdAt: '2026-10-01T00:00:00.000Z',
          current: null,
          published: null,
          scheduled: null,
          textApproved: false,
        },
      ],
      total: 1,
    })
  })

  it('lists prayers across the central subtree with the church name', async () => {
    const res = await GET(req())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.total).toBe(1)
    expect(body.result[0].churchName).toBe('Parish One')
    expect(m.requiredScope).toHaveBeenCalledWith({
      userId: 'u1',
      central: true,
      subject: 'prayer_prayer',
      action: 'read',
    })
  })

  it('passes the filters (church narrowing included) to the controller', async () => {
    await GET(req('?churchId=c2&status=current&limit=5'))

    expect(m.listCentralPrayers).toHaveBeenCalledWith({
      churchIds: new Set(['c1', 'c2']),
      query: expect.objectContaining({ churchId: 'c2', status: 'current', limit: 5 }),
    })
  })

  it('returns 403 when the caller has no central prayer read', async () => {
    m.requiredScope.mockRejectedValue(denied)

    const res = await GET(req())

    expect(res.status).toBe(403)
    expect(m.listCentralPrayers).not.toHaveBeenCalled()
  })

  it('rejects an unknown publication status with 422', async () => {
    const res = await GET(req('?status=archived'))
    expect(res.status).toBe(422)
  })
})
