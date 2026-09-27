// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/analytics', () => ({ getAttendanceSummary: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { getAttendanceSummary } from '@/controller/analytics'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const scope = () => ({
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
})
const params = { params: Promise.resolve({ churchId: 'c1' }) }

describe('GET /api/v1/admin/churches/[churchId]/attendance-summary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns aggregate attendance by date (200, no named records)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope() as never)
    vi.mocked(getAttendanceSummary).mockResolvedValue({
      from: null,
      to: null,
      days: [{ date: '2026-09-01', count: 3 }],
    } as never)

    const res = (await GET(
      new NextRequest(
        'http://localhost/api/v1/admin/churches/c1/attendance-summary?from=2026-09-01&to=2026-09-30',
      ),
      params as never,
    ))!
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.result.days[0]).toEqual({ date: '2026-09-01', count: 3 })
    expect(requiredScope).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c1', subject: 'prayer_attendance', action: 'read' }),
    )
  })

  it('returns 422 when from > to', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope() as never)
    const res = (await GET(
      new NextRequest(
        'http://localhost/api/v1/admin/churches/c1/attendance-summary?from=2026-09-30&to=2026-09-01',
      ),
      params as never,
    ))!
    expect(res.status).toBe(422)
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
      new NextRequest(
        'http://localhost/api/v1/admin/churches/c1/attendance-summary?from=2026-09-01&to=2026-09-30',
      ),
      params as never,
    ))!
    expect(res.status).toBe(403)
  })
})
