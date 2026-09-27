// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { approveText } from '@/controller/prayer'
import { GeneralError } from '@/utils/general-error'
import { POST } from './route'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/prayer', () => ({ approveText: vi.fn() }))

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const params = { params: Promise.resolve({ churchId: 'c1', prayerId: 'p1' }) }
const scope = {
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
}
const VERSION_ID = '00000000-0000-4000-8000-000000000001'
const action = { version: 3, prayerVersionId: VERSION_ID }

describe('POST approve-text', () => {
  beforeEach(() => vi.clearAllMocks())
  it('non-reviewer is denied (403)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'not a reviewer',
      }),
    )
    const req = new NextRequest('http://x/approve-text', {
      method: 'POST',
      body: JSON.stringify(action),
    })
    const res = (await POST(req, params as never))!
    expect(res.status).toBe(403)
  })
  it('approves the current snapshot (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(approveText).mockResolvedValue({ id: VERSION_ID, approvedBy: 'u1' } as never)
    const req = new NextRequest('http://x/approve-text', {
      method: 'POST',
      body: JSON.stringify(action),
    })
    const res = (await POST(req, params as never))!
    expect(res.status).toBe(200)
    expect(approveText).toHaveBeenCalledWith(expect.objectContaining({ prayerId: 'p1' }))
  })
})
