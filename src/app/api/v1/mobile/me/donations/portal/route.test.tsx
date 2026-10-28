// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'
import { NotImplementedError } from '@/utils/not-implemented-error'

const m = vi.hoisted(() => ({ requiredAuth: vi.fn(), openBillingPortal: vi.fn() }))

vi.mock('@/utils/required-auth', () => ({ default: m.requiredAuth }))
vi.mock('@/controller/donation', () => ({ openBillingPortal: m.openBillingPortal }))

import { POST } from './route'

const RETURN_URL = 'https://prayer-365.catatia.com/donations/return?outcome=manage'
const req = (payload: unknown = { returnUrl: RETURN_URL }) =>
  new NextRequest('http://x/api/v1/mobile/me/donations/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

describe('POST /api/v1/mobile/me/donations/portal', () => {
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
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(m.openBillingPortal).not.toHaveBeenCalled()
  })

  it('resolves the pledge from the token, forwards the app return URL, and never caches', async () => {
    m.openBillingPortal.mockResolvedValue({ url: 'https://billing.stripe.test/session' })

    const res = await POST(req())
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.result.url).toBe('https://billing.stripe.test/session')
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(m.openBillingPortal).toHaveBeenCalledWith({ userId: 'u1', returnUrl: RETURN_URL })
  })

  it('rejects a non-app return URL with 422 (no open redirect)', async () => {
    const res = await POST(req({ returnUrl: 'https://evil.example/portal' }))
    expect(res.status).toBe(422)
    expect(m.openBillingPortal).not.toHaveBeenCalled()
  })

  it('returns 404 NO_ACTIVE_SUBSCRIPTION when the caller has no monthly pledge', async () => {
    m.openBillingPortal.mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'NO_ACTIVE_SUBSCRIPTION',
        details: 'There is no active monthly pledge to manage.',
      }),
    )
    const res = await POST(req())
    const payload = await res.json()
    expect(res.status).toBe(404)
    expect(payload.error_code).toBe('NO_ACTIVE_SUBSCRIPTION')
  })

  it('maps a disabled integration to 503 DONATIONS_NOT_READY', async () => {
    m.openBillingPortal.mockRejectedValue(new NotImplementedError('Stripe'))
    const res = await POST(req())
    const payload = await res.json()
    expect(res.status).toBe(503)
    expect(payload.error_code).toBe('DONATIONS_NOT_READY')
  })
})
