// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-webauth', () => ({ default: vi.fn() }))
vi.mock('@/controller/mobile', () => ({ submitRequest: vi.fn() }))

import requiredAuth from '@/utils/required-webauth'
import { submitRequest } from '@/controller/mobile'
import { GeneralError } from '@/utils/general-error'
import { POST } from './route'

const params = { params: Promise.resolve({ churchId: 'c1' }) }
const body = { kind: 'prayer', subject: 'S', message: 'hi', contactMethod: 'email' }

const req = (payload: unknown, headers: Record<string, string> = { 'Idempotency-Key': 'k1' }) =>
  new NextRequest('http://x/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requiredAuth).mockResolvedValue({ session: { user: { user_id: 'u1' } } } as never)
})

describe('POST /api/v1/site/churches/[churchId]/requests', () => {
  it('derives user and church server-side, passes the key, returns a minimal ack', async () => {
    vi.mocked(submitRequest).mockResolvedValue({
      id: 'r1',
      kind: 'prayer',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const res = (await POST(req(body), params as never))!
    expect(res.status).toBe(200)
    expect(submitRequest).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', churchId: 'c1', idempotencyKey: 'k1' }),
    )
    expect((await res.json()).result).toEqual({
      id: 'r1',
      kind: 'prayer',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('rejects unknown fields (no forged church/user/status) with 422', async () => {
    for (const extra of [{ churchId: 'c2' }, { userId: 'u2' }, { status: 'done' }]) {
      const res = (await POST(req({ ...body, ...extra }), params as never))!
      expect(res.status).toBe(422)
    }
    expect(submitRequest).not.toHaveBeenCalled()
  })

  it('rejects an unknown kind with 422', async () => {
    const res = (await POST(req({ ...body, kind: 'private' }), params as never))!
    expect(res.status).toBe(422)
  })

  it('passes a missing key through so the controller returns 400', async () => {
    vi.mocked(submitRequest).mockRejectedValue(
      new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'IDEMPOTENCY_KEY_REQUIRED',
        details: 'Idempotency-Key header is required.',
      }),
    )
    const res = (await POST(req(body, {}), params as never))!
    expect(res.status).toBe(400)
    expect(submitRequest).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: undefined }),
    )
  })

  it('maps the rate limit to 429 without echoing the request', async () => {
    vi.mocked(submitRequest).mockRejectedValue(
      new GeneralError({
        code: 429,
        error: 'TOO_MANY_REQUESTS',
        error_code: 'RATE_LIMITED',
        details: 'Too many requests sent. Please try again later.',
      }),
    )
    const res = (await POST(req(body), params as never))!
    expect(res.status).toBe(429)
    const out = await res.json()
    expect(out.error_code).toBe('RATE_LIMITED')
    // request_id is random and can contain the probe string by chance — drop it from the echo check.
    delete out.request_id
    expect(JSON.stringify(out)).not.toContain('hi')
  })
})
