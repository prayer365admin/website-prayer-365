// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'
import { NotImplementedError } from '@/utils/not-implemented-error'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  initiateDonation: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('@/controller/donation', () => ({ initiateDonation: m.initiateDonation }))

import { POST } from './route'

const params = { params: Promise.resolve({ churchId: 'c1' }) }
const body = { amountMinor: 1000, currency: 'EUR', frequency: 'monthly' }

const req = (payload: unknown, headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/v1/site/churches/c1/donations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  })

describe('POST /api/v1/site/churches/[churchId]/donations', () => {
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

    const res = await POST(req(body), params as never)

    expect(res.status).toBe(401)
    expect(m.initiateDonation).not.toHaveBeenCalled()
  })

  it('derives giver and church server-side and forwards the Idempotency-Key', async () => {
    const fixture = {
      sessionId: 'cs_1',
      url: 'https://checkout.stripe.test/cs_1',
      churchId: 'c1',
      amountMinor: 1000,
      currency: 'eur',
      frequency: 'monthly',
    }
    m.initiateDonation.mockResolvedValue(fixture)

    const res = (await POST(req(body, { 'idempotency-key': 'idem-1' }), params as never))!

    expect(res.status).toBe(200)
    expect(m.initiateDonation).toHaveBeenCalledWith({
      churchId: 'c1',
      userId: 'u1',
      input: expect.objectContaining({ amountMinor: 1000, currency: 'eur', frequency: 'monthly' }),
      idempotencyKey: 'idem-1',
    })
    expect((await res.json()).result).toEqual(fixture)
  })

  it('generates a key when the caller sends none', async () => {
    m.initiateDonation.mockResolvedValue({ sessionId: 'cs_2', url: 'https://x.test/cs_2' })

    const res = (await POST(req(body), params as never))!

    expect(res.status).toBe(200)
    expect(m.initiateDonation.mock.calls[0][0].idempotencyKey).toEqual(expect.any(String))
  })

  it('maps a disabled integration to 503 DONATIONS_NOT_READY', async () => {
    m.initiateDonation.mockRejectedValue(new NotImplementedError('STRIPE.createCheckoutSession'))

    const res = (await POST(req(body), params as never))!

    expect(res.status).toBe(503)
    expect((await res.json()).error_code).toBe('DONATIONS_NOT_READY')
  })

  it('passes an ineligible church through as 400', async () => {
    m.initiateDonation.mockRejectedValue(
      new GeneralError({
        code: 400,
        error: 'PAYMENT_ERROR',
        error_code: 'CHURCH_NOT_ELIGIBLE',
        details: 'Church is not eligible to receive donations (status: SUSPENDED).',
      }),
    )

    const res = (await POST(req(body), params as never))!

    expect(res.status).toBe(400)
    expect((await res.json()).error_code).toBe('CHURCH_NOT_ELIGIBLE')
  })

  it('rejects unknown fields and bad amounts with 422', async () => {
    for (const payload of [
      { ...body, churchId: 'c2' },
      { ...body, userId: 'u2' },
      { ...body, amountMinor: 0 },
      { ...body, frequency: 'weekly' },
    ]) {
      const res = (await POST(req(payload), params as never))!
      expect(res.status).toBe(422)
    }
    expect(m.initiateDonation).not.toHaveBeenCalled()
  })
})
