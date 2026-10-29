// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'
import { NotImplementedError } from '@/utils/not-implemented-error'

const m = vi.hoisted(() => ({ requiredAuth: vi.fn(), initiateDonation: vi.fn() }))

vi.mock('@/utils/required-auth', () => ({ default: m.requiredAuth }))
vi.mock('@/controller/donation', () => ({ initiateDonation: m.initiateDonation }))

import { POST } from './route'

const CHURCH = '01a0f73b-7860-75cc-a58d-febcab0ac0f7'
const body = {
  amountMinor: 2500,
  currency: 'EUR',
  frequency: 'one_time',
  successUrl: 'https://prayer-365.catatia.com/donations/return?outcome=success',
  cancelUrl: 'https://prayer-365.catatia.com/donations/return?outcome=cancel',
}

const req = (
  payload: unknown = body,
  headers: Record<string, string> = { 'Idempotency-Key': 'key-1' },
) =>
  new NextRequest(`http://x/api/v1/mobile/churches/${CHURCH}/donations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  })

const params = { params: Promise.resolve({ churchId: CHURCH }) }
const UNAUTH = new GeneralError({
  code: 401,
  error: 'Not Authenticated!',
  error_code: 'UNAUTHORIZED',
  details: 'Please login and try again!',
})

describe('POST /api/v1/mobile/churches/:churchId/donations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.requiredAuth.mockResolvedValue({ session: { user: { user_id: 'u1' } } })
  })

  it('returns 401 without a bearer token and never starts a session', async () => {
    m.requiredAuth.mockRejectedValue(UNAUTH)
    const res = await POST(req(), params)
    expect(res.status).toBe(401)
    expect(m.initiateDonation).not.toHaveBeenCalled()
  })

  it('rejects a missing Idempotency-Key with 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
    const res = await POST(req(body, {}), params)
    const payload = await res.json()
    expect(res.status).toBe(400)
    expect(payload.error_code).toBe('IDEMPOTENCY_KEY_REQUIRED')
    expect(m.initiateDonation).not.toHaveBeenCalled()
  })

  it('takes the church from the path, the giver from the token, and forwards the key', async () => {
    m.initiateDonation.mockResolvedValue({
      sessionId: 'cs_1',
      url: 'https://checkout.stripe.test/cs_1',
      churchId: CHURCH,
      amountMinor: 2500,
      currency: 'eur',
      frequency: 'one_time',
    })

    const res = await POST(req(), params)
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.result.sessionId).toBe('cs_1')
    expect(payload.result.url).toBe('https://checkout.stripe.test/cs_1')
    expect(m.initiateDonation).toHaveBeenCalledWith({
      churchId: CHURCH,
      userId: 'u1',
      idempotencyKey: 'key-1',
      input: expect.objectContaining({ amountMinor: 2500, currency: 'eur' }),
    })
  })

  it('rejects a foreign return URL with 422 before touching the controller', async () => {
    const res = await POST(req({ ...body, successUrl: 'https://evil.example/thanks' }), params)
    expect(res.status).toBe(422)
    expect(m.initiateDonation).not.toHaveBeenCalled()
  })

  it('surfaces CHURCH_NOT_ELIGIBLE from the controller', async () => {
    m.initiateDonation.mockRejectedValue(
      new GeneralError({
        code: 400,
        error: 'PAYMENT_ERROR',
        error_code: 'CHURCH_NOT_ELIGIBLE',
        details: 'Church is not eligible to receive donations (status: PENDING).',
      }),
    )
    const res = await POST(req(), params)
    const payload = await res.json()
    expect(res.status).toBe(400)
    expect(payload.error_code).toBe('CHURCH_NOT_ELIGIBLE')
  })

  it('maps a disabled integration to 503 DONATIONS_NOT_READY', async () => {
    m.initiateDonation.mockRejectedValue(new NotImplementedError('Stripe'))
    const res = await POST(req(), params)
    const payload = await res.json()
    expect(res.status).toBe(503)
    expect(payload.error_code).toBe('DONATIONS_NOT_READY')
  })
})
