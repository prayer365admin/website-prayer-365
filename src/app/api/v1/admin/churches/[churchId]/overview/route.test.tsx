// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/church', () => ({ getChurchOverview: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { getChurchOverview } from '@/controller/church'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const params = { params: Promise.resolve({ churchId: 'c1' }) }

const overview = {
  church: { id: 'c1', name: 'A', status: 'APPROVED', timezone: 'UTC', city: 'X', version: 3 },
  aggregates: {
    serviceTimeCount: 2,
    pastorCount: 1,
    prayerCount: 4,
    eventCount: 1,
    announcementCount: 0,
    memberCount: 5,
    mediaCount: 2,
  },
}

describe('GET /api/v1/admin/churches/[churchId]/overview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns overview (200) scoped to the resolved church', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue({
      userId: 'u1',
      churchIds: new Set(['c1']),
      scope: { kind: 'church', orgNodeId: 'n1', name: '' },
    } as never)
    vi.mocked(getChurchOverview).mockResolvedValue(overview as never)

    const res = (await GET(
      new NextRequest('http://localhost/api/v1/admin/churches/c1/overview'),
      params as never,
    ))!
    expect(res.status).toBe(200)
    expect((await res.json()).result.church.id).toBe('c1')
    expect(requiredScope).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c1', subject: 'prayer_church', action: 'read' }),
    )
  })

  it('returns 403 when scope is denied (cross-church)', async () => {
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
      new NextRequest('http://localhost/api/v1/admin/churches/c9/overview'),
      params as never,
    ))!
    expect(res.status).toBe(403)
  })

  it('returns 404 when the church is unknown (hide existence)', async () => {
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
      new NextRequest('http://localhost/api/v1/admin/churches/ghost/overview'),
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
      new NextRequest('http://localhost/api/v1/admin/churches/c1/overview'),
      params as never,
    ))!
    expect(res.status).toBe(401)
  })
})
