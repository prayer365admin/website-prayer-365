// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-webauth', () => ({ default: vi.fn() }))
vi.mock('@/controller/mobile', () => ({ recordAnalyticsEvents: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import requiredWebAuth from '@/utils/required-webauth'
import { recordAnalyticsEvents } from '@/controller/mobile'
import { GeneralError } from '@/utils/general-error'
import { revalidatePath } from 'next/cache'
import { POST } from './route'

const listen = {
  eventKey: 'k1',
  eventType: 'prayer_listen',
  occurredAt: '2026-10-17T10:00:00.000Z',
  resourceId: 'p1',
}
const req = (payload: unknown) =>
  new NextRequest('http://x/analytics-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requiredWebAuth).mockResolvedValue({ session: { user: { user_id: 'u1' } } } as never)
})

describe('POST /api/v1/site/analytics-events', () => {
  it('records events for the session user only', async () => {
    vi.mocked(recordAnalyticsEvents).mockResolvedValue({ accepted: 1 })
    const res = await POST(req({ events: [listen] }))
    expect(res.status).toBe(200)
    expect(recordAnalyticsEvents).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', input: { events: [listen] } }),
    )
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('rejects unknown event types and forged user fields with 422', async () => {
    for (const bad of [
      { ...listen, eventType: 'hack' },
      { ...listen, userId: 'u2' },
    ]) {
      expect((await POST(req({ events: [bad] }))).status).toBe(422)
    }
    expect(recordAnalyticsEvents).not.toHaveBeenCalled()
  })

  it('returns 401 without a live website session', async () => {
    vi.mocked(requiredWebAuth).mockRejectedValue(
      new GeneralError({
        code: 401,
        error: 'Not Authenticated!',
        error_code: 'UNAUTHORIZED',
        details: '',
      }),
    )
    expect((await POST(req({ events: [listen] }))).status).toBe(401)
  })
})
