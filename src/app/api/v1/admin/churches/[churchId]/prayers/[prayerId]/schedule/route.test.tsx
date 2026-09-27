// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { schedulePrayer } from '@/controller/prayer'
import { GeneralError } from '@/utils/general-error'
import { PUT } from './route'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/prayer', () => ({ schedulePrayer: vi.fn() }))

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const params = { params: Promise.resolve({ churchId: 'c1', prayerId: 'p1' }) }
const scope = {
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
}
const VERSION_ID = '00000000-0000-4000-8000-000000000001'
const sched = { version: 3, prayerVersionId: VERSION_ID, scheduledAt: '2026-10-01T10:00:00Z' }

describe('PUT schedule', () => {
  beforeEach(() => vi.clearAllMocks())
  it('schedules an approved current version (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(schedulePrayer).mockResolvedValue({
      id: 'p1',
      scheduled: { prayerVersionId: VERSION_ID, scheduledAt: sched.scheduledAt },
    } as never)
    const req = new NextRequest('http://x/schedule', { method: 'PUT', body: JSON.stringify(sched) })
    const res = (await PUT(req, params as never))!
    expect(res.status).toBe(200)
    expect(schedulePrayer).toHaveBeenCalledWith(expect.objectContaining({ prayerId: 'p1' }))
  })
  it('clears the schedule when scheduledAt is null (both-or-null)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(schedulePrayer).mockResolvedValue({ id: 'p1', scheduled: null } as never)
    const req = new NextRequest('http://x/schedule', {
      method: 'PUT',
      body: JSON.stringify({ ...sched, scheduledAt: null }),
    })
    const res = (await PUT(req, params as never))!
    expect(res.status).toBe(200)
  })
  it('returns 409 when the current text is not approved', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(schedulePrayer).mockRejectedValue(
      new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'PRAYER_NOT_APPROVED',
        details: 'approve first',
      }),
    )
    const req = new NextRequest('http://x/schedule', { method: 'PUT', body: JSON.stringify(sched) })
    const res = (await PUT(req, params as never))!
    expect(res.status).toBe(409)
  })
})
