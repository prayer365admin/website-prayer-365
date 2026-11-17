// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({ getPublicDonationStatus: vi.fn() }))

vi.mock('@/controller/donation', () => ({ getPublicDonationStatus: m.getPublicDonationStatus }))

import { GET } from './route'

const req = (search = '?sessionId=cs_1') =>
  new NextRequest(`http://localhost/api/v1/site/donations/public/status${search}`)

beforeEach(() => vi.clearAllMocks())

describe('GET /api/v1/site/donations/public/status', () => {
  it('returns the outcome and is never cached', async () => {
    m.getPublicDonationStatus.mockResolvedValue({
      state: 'confirmed',
      amountMinor: 1000,
      currency: 'EUR',
      paidAt: new Date('2026-11-12T09:15:00.000Z'),
    })

    const res = await GET(req())

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(m.getPublicDonationStatus).toHaveBeenCalledWith({ query: { sessionId: 'cs_1' } })
    expect(await res.json()).toMatchObject({
      result: { state: 'confirmed', amountMinor: 1000, currency: 'EUR' },
    })
  })

  it('passes the 404 of a non-platform session through', async () => {
    m.getPublicDonationStatus.mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'Checkout session not found.',
      }),
    )

    const res = await GET(req())

    expect(res.status).toBe(404)
    // Errors are session-specific too: no shared cache may replay them.
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect((await res.json()).error_code).toBe('RESOURCE_NOT_FOUND')
  })

  it('422s a session id that is not a checkout session', async () => {
    for (const search of ['', '?sessionId=pi_1', '?sessionId=cs_1&churchId=c1']) {
      const res = await GET(req(search))
      expect(res.status).toBe(422)
    }
    expect(m.getPublicDonationStatus).not.toHaveBeenCalled()
  })

  it('maps a missing platform row to 503 DONATIONS_NOT_READY', async () => {
    m.getPublicDonationStatus.mockRejectedValue(
      new GeneralError({
        code: 503,
        error: 'SERVICE_UNAVAILABLE',
        error_code: 'DONATIONS_NOT_READY',
        details: 'Donations are not ready yet. Please try again later.',
      }),
    )

    const res = await GET(req())

    expect(res.status).toBe(503)
    expect((await res.json()).error_code).toBe('DONATIONS_NOT_READY')
  })
})
