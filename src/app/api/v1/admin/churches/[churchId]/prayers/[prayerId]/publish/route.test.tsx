// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { publishPrayer } from '@/controller/prayer'
import { GeneralError } from '@/utils/general-error'
import { POST } from './route'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/prayer', () => ({ publishPrayer: vi.fn() }))

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const params = { params: Promise.resolve({ churchId: 'c1', prayerId: 'p1' }) }
const scope = {
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
}
const VERSION_ID = '00000000-0000-4000-8000-000000000001'
const action = { version: 3, prayerVersionId: VERSION_ID }

describe('POST publish', () => {
  beforeEach(() => vi.clearAllMocks())
  it('publishes an approved version (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(publishPrayer).mockResolvedValue({ id: 'p1', version: 4 } as never)
    const req = new NextRequest('http://x/publish', {
      method: 'POST',
      body: JSON.stringify(action),
      headers: { 'idempotency-key': 'k1' },
    })
    const res = (await POST(req, params as never))!
    expect(res.status).toBe(200)
    expect(publishPrayer).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'k1', prayerId: 'p1' }),
    )
  })
  it('returns 409 when the current text is not approved (unapproved cannot publish)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(publishPrayer).mockRejectedValue(
      new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'PRAYER_NOT_APPROVED',
        details: 'approve first',
      }),
    )
    const req = new NextRequest('http://x/publish', {
      method: 'POST',
      body: JSON.stringify(action),
      headers: { 'idempotency-key': 'k1' },
    })
    const res = (await POST(req, params as never))!
    expect(res.status).toBe(409)
    expect((await res.json()).error_code).toBe('PRAYER_NOT_APPROVED')
  })
})
