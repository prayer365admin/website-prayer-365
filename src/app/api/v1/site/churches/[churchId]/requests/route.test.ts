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

    const req = new NextRequest('http://localhost/api/v1/site/churches/c1/requests', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'prayer',
        subject: 'Prayer petition',
        message: 'Please pray for peace.',
      }),
    })

    const res = await POST(req, {
      params: Promise.resolve({ churchId: 'c1' }),
    })

    expect(res.status).toBe(401)
  })

  it('returns 200 with request ack on successful submission', async () => {
    const fixture = {
      id: 'req-1',
      kind: 'prayer',
      createdAt: '2026-10-15T12:00:00.000Z',
    }
    m.submitRequest.mockResolvedValue(fixture)

    const req = new NextRequest('http://localhost/api/v1/site/churches/c1/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idempotency-key': 'idem-1',
      },
      body: JSON.stringify({
        kind: 'prayer',
        subject: 'Prayer for family',
        message: 'Please pray for our family peace.',
        classification: 'PRIVATE',
      }),
    })

    const res = await POST(req, {
      params: Promise.resolve({ churchId: 'c1' }),
    })
    const body = await res.json()

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
    expect(body.result.id).toBe('req-1')
  })

  it('returns 422 when validation fails', async () => {
    const req = new NextRequest('http://localhost/api/v1/site/churches/c1/requests', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'invalid-kind',
      }),
    })

    const res = await POST(req, {
      params: Promise.resolve({ churchId: 'c1' }),
    })

    expect(res.status).toBe(422)
  })
})
