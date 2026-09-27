// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { enqueueAudio } from '@/controller/prayer-audio'
import { GeneralError } from '@/utils/general-error'
import { POST } from './route'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/prayer-audio', () => ({ enqueueAudio: vi.fn() }))

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const params = { params: Promise.resolve({ churchId: 'c1', prayerId: 'p1' }) }
const scope = {
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
}
const VERSION_ID = '00000000-0000-4000-8000-000000000001'
const VOICE_ID = '00000000-0000-4000-8000-000000000005'
const body = { version: 3, prayerVersionId: VERSION_ID, voiceProfileId: VOICE_ID }

describe('POST audio', () => {
  beforeEach(() => vi.clearAllMocks())
  it('queues audio generation → 202', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(enqueueAudio).mockResolvedValue({ id: 'a1', status: 'QUEUED' } as never)
    const req = new NextRequest('http://x/audio', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'idempotency-key': 'k1' },
    })
    const res = (await POST(req, params as never))!
    expect(res.status).toBe(202)
    expect(enqueueAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'k1',
        input: expect.objectContaining({ voiceProfileId: VOICE_ID }),
      }),
    )
  })
  it('returns 409 when generation is attempted before approval', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(enqueueAudio).mockRejectedValue(
      new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'GENERATION_BEFORE_APPROVAL',
        details: 'approve first',
      }),
    )
    const req = new NextRequest('http://x/audio', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'idempotency-key': 'k1' },
    })
    const res = (await POST(req, params as never))!
    expect(res.status).toBe(409)
    expect((await res.json()).error_code).toBe('GENERATION_BEFORE_APPROVAL')
  })
})
