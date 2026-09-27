// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/analytics', () => ({ getRegionSummary: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { getRegionSummary } from '@/controller/analytics'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const scope = () => ({
  userId: 'u1',
  churchIds: new Set(['c1', 'c2']),
  scope: { kind: 'deanery', orgNodeId: 'r1', name: '' },
})
const params = { params: Promise.resolve({ regionId: 'r1' }) }

describe('GET /api/v1/admin/regions/[regionId]/summary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a descendant-only region aggregate (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope() as never)
    vi.mocked(getRegionSummary).mockResolvedValue({
      regionId: 'r1',
      churchCount: 2,
      memberCount: 20,
      activeMembers: 5,
      checkInCount: 30,
      eventCount: 4,
      prayerCount: 9,
      donationCount: 12,
      totalGrossByCurrency: [{ currency: 'USD', grossMinor: '5000' }],
    } as never)

    const res = (await GET(
      new NextRequest(
        'http://localhost/api/v1/admin/regions/r1/summary?from=2026-09-01&to=2026-09-30',
      ),
      params as never,
    ))!
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.result.churchCount).toBe(2)
    expect(requiredScope).toHaveBeenCalledWith(
      expect.objectContaining({ regionId: 'r1', subject: 'prayer_analytics', action: 'read' }),
    )
  })

  it('returns 403 when the region scope is not covered by an assignment', async () => {
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
      new NextRequest(
        'http://localhost/api/v1/admin/regions/r1/summary?from=2026-09-01&to=2026-09-30',
      ),
      params as never,
    ))!
    expect(res.status).toBe(403)
  })

  it('returns 404 for an unknown region (hide existence)', async () => {
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
      new NextRequest(
        'http://localhost/api/v1/admin/regions/ghost/summary?from=2026-09-01&to=2026-09-30',
      ),
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
      new NextRequest(
        'http://localhost/api/v1/admin/regions/r1/summary?from=2026-09-01&to=2026-09-30',
      ),
      params as never,
    ))!
    expect(res.status).toBe(401)
  })
})
