// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/analytics', () => ({ getAnalytics: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { getAnalytics } from '@/controller/analytics'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const scope = () => ({
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
})
const params = { params: Promise.resolve({ churchId: 'c1' }) }

describe('GET /api/v1/admin/churches/[churchId]/analytics', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns bounded analytics metrics (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope() as never)
    vi.mocked(getAnalytics).mockResolvedValue({
      from: new Date('2026-09-01T00:00:00Z'),
      to: new Date('2026-09-30T00:00:00Z'),
      checkInCount: 10,
      eventCount: 2,
      prayerCount: 5,
      donationCount: 7,
      activeMembers: 4,
    } as never)

    const res = (await GET(
      new NextRequest(
        'http://localhost/api/v1/admin/churches/c1/analytics?from=2026-09-01&to=2026-09-30',
      ),
      params as never,
    ))!
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.result.checkInCount).toBe(10)
    expect(requiredScope).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c1', subject: 'prayer_analytics', action: 'read' }),
    )
  })

  it('returns 422 when from > to (bound validation)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope() as never)
    const res = (await GET(
      new NextRequest(
        'http://localhost/api/v1/admin/churches/c1/analytics?from=2026-09-30&to=2026-09-01',
      ),
      params as never,
    ))!
    expect(res.status).toBe(422)
  })

  it('returns 404 for an out-of-scope church', async () => {
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
        'http://localhost/api/v1/admin/churches/ghost/analytics?from=2026-09-01&to=2026-09-30',
      ),
      params as never,
    ))!
    expect(res.status).toBe(404)
  })
})
