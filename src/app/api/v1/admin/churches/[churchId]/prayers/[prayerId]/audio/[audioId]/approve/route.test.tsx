// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { approveAudio } from '@/controller/prayer-audio'
import { GeneralError } from '@/utils/general-error'
import { POST } from './route'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/prayer-audio', () => ({ approveAudio: vi.fn() }))

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const params = { params: Promise.resolve({ churchId: 'c1', prayerId: 'p1', audioId: 'a1' }) }
const scope = {
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
}
const VERSION_ID = '00000000-0000-4000-8000-000000000001'
const action = { version: 3, prayerVersionId: VERSION_ID }

describe('POST audio/:audioId/approve', () => {
  beforeEach(() => vi.clearAllMocks())
  it('rejects a non-reviewer (403)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'no',
      }),
    )
    const req = new NextRequest('http://x/approve', {
      method: 'POST',
      body: JSON.stringify(action),
    })
    const res = (await POST(req, params as never))!
    expect(res.status).toBe(403)
  })
  it('approves READY audio on the current snapshot (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(approveAudio).mockResolvedValue({ id: 'a1', status: 'APPROVED' } as never)
    const req = new NextRequest('http://x/approve', {
      method: 'POST',
      body: JSON.stringify(action),
    })
    const res = (await POST(req, params as never))!
    expect(res.status).toBe(200)
    expect((await res.json()).result.status).toBe('APPROVED')
    expect(approveAudio).toHaveBeenCalledWith(expect.objectContaining({ audioId: 'a1' }))
  })
  it('returns 409 on a wrong snapshot / not-current version', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(approveAudio).mockRejectedValue(
      new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'WRONG_SNAPSHOT',
        details: 'snapshot',
      }),
    )
    const req = new NextRequest('http://x/approve', {
      method: 'POST',
      body: JSON.stringify(action),
    })
    const res = (await POST(req, params as never))!
    expect(res.status).toBe(409)
  })
})
