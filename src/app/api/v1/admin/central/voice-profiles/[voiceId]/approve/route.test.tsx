// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { approveProfile } from '@/controller/voice'
import { GeneralError } from '@/utils/general-error'
import { POST } from './route'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/voice', () => ({ approveProfile: vi.fn() }))

const auth = () => ({ session: { user: { user_id: 'reviewer-u' } } })
const params = { params: Promise.resolve({ voiceId: 'profile-1' }) }
const action = { version: 2 }

beforeEach(() => vi.clearAllMocks())

describe('POST /central/voice-profiles/:voiceId/approve', () => {
  it('returns 202 with the approved profile', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue({} as never)
    vi.mocked(approveProfile).mockResolvedValue({
      id: 'profile-1',
      reviewState: 'APPROVED',
    } as never)
    const req = new NextRequest('http://x/approve', {
      method: 'POST',
      body: JSON.stringify(action),
      headers: { 'idempotency-key': 'k1' },
    })
    const res = (await POST(req, params as never))!
    expect(res.status).toBe(202)
    expect(approveProfile).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'k1' }))
  })

  it('returns 403 when the caller lacks voice-review permission (unauthorized)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'not allowed',
      }),
    )
    const req = new NextRequest('http://x/approve', {
      method: 'POST',
      body: JSON.stringify(action),
    })
    const res = (await POST(req, params as never))!
    expect(res.status).toBe(403)
    expect((await res.json()).success).toBeUndefined()
  })
})
