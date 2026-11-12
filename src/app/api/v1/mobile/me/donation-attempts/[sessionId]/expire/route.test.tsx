// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'
import { NotImplementedError } from '@/utils/not-implemented-error'

const m = vi.hoisted(() => ({ requiredAuth: vi.fn(), expireDonationAttempt: vi.fn() }))

vi.mock('@/utils/required-auth', () => ({ default: m.requiredAuth }))
vi.mock('@/controller/donation', () => ({ expireDonationAttempt: m.expireDonationAttempt }))

import { POST } from './route'

const call = () =>
  POST(
    new NextRequest('http://x/api/v1/mobile/me/donation-attempts/cs_1/expire', { method: 'POST' }),
    { params: Promise.resolve({ sessionId: 'cs_1' }) },
  )

describe('POST /api/v1/mobile/me/donation-attempts/:sessionId/expire', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.requiredAuth.mockResolvedValue({ session: { user: { user_id: 'u1' } } })
  })

  it('returns 401 without a bearer token', async () => {
    m.requiredAuth.mockRejectedValue(
      new GeneralError({
        code: 401,
        error: 'Not Authenticated!',
        error_code: 'UNAUTHORIZED',
        details: 'Please login and try again!',
      }),
    )
    expect((await call()).status).toBe(401)
    expect(m.expireDonationAttempt).not.toHaveBeenCalled()
  })

  it('expires the caller’s own session and never caches', async () => {
    m.expireDonationAttempt.mockResolvedValue({ state: 'expired' })
    const res = await call()
    expect(res.status).toBe(200)
    expect((await res.json()).result).toEqual({ state: 'expired' })
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(m.expireDonationAttempt).toHaveBeenCalledWith({ userId: 'u1', sessionId: 'cs_1' })
  })

  it('passes a completed answer through', async () => {
    m.expireDonationAttempt.mockResolvedValue({ state: 'completed' })
    expect((await (await call()).json()).result.state).toBe('completed')
  })

  it('surfaces 404 for a session that is not the caller’s', async () => {
    m.expireDonationAttempt.mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'DONATION_ATTEMPT_NOT_FOUND',
        details: 'Donation attempt not found.',
      }),
    )
    const res = await call()
    expect(res.status).toBe(404)
    expect((await res.json()).error_code).toBe('DONATION_ATTEMPT_NOT_FOUND')
  })

  it('answers 503 DONATIONS_NOT_READY when Stripe is off', async () => {
    m.expireDonationAttempt.mockRejectedValue(new NotImplementedError('STRIPE.x'))
    const res = await call()
    expect(res.status).toBe(503)
    expect((await res.json()).error_code).toBe('DONATIONS_NOT_READY')
  })
})
