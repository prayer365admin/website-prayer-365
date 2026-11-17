// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'
import { NotImplementedError } from '@/utils/not-implemented-error'

const m = vi.hoisted(() => ({ initiatePublicDonation: vi.fn() }))

vi.mock('@/controller/donation', () => ({ initiatePublicDonation: m.initiatePublicDonation }))

import { POST } from './route'

const body = { amountMinor: 1000, currency: 'eur', frequency: 'one_time' }

const req = (payload: unknown) =>
  new NextRequest('http://localhost/api/v1/site/donations/public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

beforeEach(() => vi.clearAllMocks())

describe('POST /api/v1/site/donations/public', () => {
  it('creates a session for an anonymous caller (no session is read)', async () => {
    const fixture = {
      sessionId: 'cs_1',
      url: 'https://checkout.stripe.test/cs_1',
      churchId: 'p1',
      amountMinor: 1000,
      currency: 'eur',
      frequency: 'one_time',
    }
    m.initiatePublicDonation.mockResolvedValue(fixture)

    const res = await POST(req(body))

    expect(res.status).toBe(200)
    expect(m.initiatePublicDonation).toHaveBeenCalledWith({ input: body })
    expect((await res.json()).result).toEqual(fixture)
  })

  it('forwards the raw body once and surfaces the controller validation as 422', async () => {
    // The schema lives in the controller, so a body that names a church or a
    // return URL is refused there — the route only carries the status through.
    m.initiatePublicDonation.mockRejectedValue(
      new GeneralError({
        code: 422,
        error: 'VALIDATION_ERROR',
        error_code: 'VALIDATION_ERROR',
        details: 'Invalid request payload.',
      }),
    )

    const res = await POST(req({ ...body, churchId: 'c1' }))

    expect(res.status).toBe(422)
    expect(m.initiatePublicDonation).toHaveBeenCalledWith({
      input: { ...body, churchId: 'c1' },
    })
  })

  it('422s a body that is not JSON without reaching the controller', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/v1/site/donations/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'oops',
      }),
    )

    expect(res.status).toBe(422)
    expect((await res.json()).error_code).toBe('VALIDATION_ERROR')
    expect(m.initiatePublicDonation).not.toHaveBeenCalled()
  })

  it('maps a disabled integration to 503 DONATIONS_NOT_READY', async () => {
    m.initiatePublicDonation.mockRejectedValue(
      new NotImplementedError('STRIPE.createCheckoutSession'),
    )

    const res = await POST(req(body))

    expect(res.status).toBe(503)
    expect((await res.json()).error_code).toBe('DONATIONS_NOT_READY')
  })

  it('maps a missing platform row to 503 DONATIONS_NOT_READY', async () => {
    m.initiatePublicDonation.mockRejectedValue(
      new GeneralError({
        code: 503,
        error: 'SERVICE_UNAVAILABLE',
        error_code: 'DONATIONS_NOT_READY',
        details: 'Donations are not ready yet. Please try again later.',
      }),
    )

    const res = await POST(req(body))

    expect(res.status).toBe(503)
    expect((await res.json()).error_code).toBe('DONATIONS_NOT_READY')
  })
})
