// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { RESOLVE_OWN_SCOPE } from '@/providers/voice'
import { submitSubmission } from '@/controller/voice'
import { GeneralError } from '@/utils/general-error'
import { POST } from './route'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/providers/voice', () => ({ RESOLVE_OWN_SCOPE: vi.fn() }))
vi.mock('@/controller/voice', () => ({ submitSubmission: vi.fn() }))

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const params = { params: Promise.resolve({ id: 'profile-1' }) }

beforeEach(() => vi.clearAllMocks())

describe('POST /me/voice-submissions/:id/submit', () => {
  it('submits an own draft and forwards the idempotency key', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(RESOLVE_OWN_SCOPE).mockResolvedValue({
      anchorChurchId: 'c1',
      churchIds: new Set(['c1']),
    })
    vi.mocked(requiredScope).mockResolvedValue({} as never)
    vi.mocked(submitSubmission).mockResolvedValue({
      id: 'profile-1',
      reviewState: 'SUBMITTED',
    } as never)
    const req = new NextRequest('http://x/submit', {
      method: 'POST',
      body: JSON.stringify({ version: 1 }),
      headers: { 'idempotency-key': 'key-1' },
    })
    const res = (await POST(req, params as never))!
    expect(res.status).toBe(200)
    expect(submitSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'key-1', profileId: 'profile-1' }),
    )
  })

  it('returns 403 when not linked to an assigned pastor church', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(RESOLVE_OWN_SCOPE).mockResolvedValue({ anchorChurchId: null, churchIds: new Set() })
    const req = new NextRequest('http://x/submit', {
      method: 'POST',
      body: JSON.stringify({ version: 1 }),
    })
    const res = (await POST(req, params as never))!
    expect(res.status).toBe(403)
  })

  it('returns 403 when the update grant is missing', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(RESOLVE_OWN_SCOPE).mockResolvedValue({
      anchorChurchId: 'c1',
      churchIds: new Set(['c1']),
    })
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'no',
      }),
    )
    const req = new NextRequest('http://x/submit', {
      method: 'POST',
      body: JSON.stringify({ version: 1 }),
    })
    const res = (await POST(req, params as never))!
    expect(res.status).toBe(403)
  })
})
