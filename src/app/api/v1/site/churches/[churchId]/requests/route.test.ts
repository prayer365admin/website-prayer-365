// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  submitRequest: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('@/controller/mobile', () => ({ submitRequest: m.submitRequest }))

import { POST } from './route'

const params = { params: Promise.resolve({ churchId: 'c1' }) }
const body = { kind: 'prayer', subject: 'S', message: 'hi', contactMethod: 'email' }

const req = (payload: unknown, headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/v1/site/churches/c1/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  })

describe('POST /api/v1/site/churches/[churchId]/requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.requiredWebAuth.mockResolvedValue({
      session: { user: { user_id: 'u1' } },
      user: { id: 'u1' },
    })
  })

  it('returns 401 when website authentication fails', async () => {
    m.requiredWebAuth.mockRejectedValue(
      new GeneralError({
        code: 401,
        error: 'Not Authenticated!',
        error_code: 'UNAUTHORIZED',
        details: 'Please login and try again!',
      }),
    )

    const res = await POST(
      req({ kind: 'prayer', subject: 'Prayer petition', message: 'Please pray for peace.' }),
      params as never,
    )

    expect(res.status).toBe(401)
  })

  it('derives user and church server-side, passes the key, returns a minimal ack', async () => {
    const fixture = {
      id: 'req-1',
      kind: 'prayer',
      createdAt: '2026-10-15T12:00:00.000Z',
    }
    m.submitRequest.mockResolvedValue(fixture)

    const res = (await POST(
      req(
        {
          kind: 'prayer',
          subject: 'Prayer for family',
          message: 'Please pray for our family peace.',
          classification: 'PRIVATE',
        },
        { 'idempotency-key': 'idem-1' },
      ),
      params as never,
    ))!

    expect(res.status).toBe(200)
    expect(m.submitRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        churchId: 'c1',
        idempotencyKey: 'idem-1',
        input: expect.objectContaining({
          kind: 'prayer',
          subject: 'Prayer for family',
          message: 'Please pray for our family peace.',
          classification: 'PRIVATE',
        }),
      }),
    )
    expect((await res.json()).result).toEqual(fixture)
  })

  it('generates a key server-side when the caller sends none', async () => {
    m.submitRequest.mockResolvedValue({
      id: 'r1',
      kind: 'prayer',
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    const res = (await POST(req(body), params as never))!

    expect(res.status).toBe(200)
    const passed = m.submitRequest.mock.calls[0][0]
    expect(passed.idempotencyKey).toEqual(expect.any(String))
    expect(passed.idempotencyKey).not.toBe('')
  })

  it('returns 422 when validation fails', async () => {
    const res = await POST(req({ kind: 'invalid-kind' }), params as never)

    expect(res.status).toBe(422)
  })

  it('rejects unknown fields (no forged church/user/status) with 422', async () => {
    for (const extra of [{ churchId: 'c2' }, { userId: 'u2' }, { status: 'done' }]) {
      const res = (await POST(req({ ...body, ...extra }), params as never))!
      expect(res.status).toBe(422)
    }
    expect(m.submitRequest).not.toHaveBeenCalled()
  })

  it('rejects an unknown kind with 422', async () => {
    const res = (await POST(req({ ...body, kind: 'private' }), params as never))!

    expect(res.status).toBe(422)
  })

  it('maps the rate limit to 429 without echoing the request', async () => {
    m.submitRequest.mockRejectedValue(
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
