// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'
import { NotImplementedError } from '@/utils/not-implemented-error'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  openBillingPortal: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('@/controller/donation', () => ({ openBillingPortal: m.openBillingPortal }))

import { POST } from './route'

const req = (payload?: unknown) =>
  new NextRequest('http://localhost/api/v1/site/donations/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  })

describe('POST /api/v1/site/donations/portal', () => {
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

    const res = await POST(req({ returnPath: '/donate' }))

    expect(res.status).toBe(401)
    expect(m.openBillingPortal).not.toHaveBeenCalled()
  })

  it('resolves the return url against this origin and never caches the answer', async () => {
    m.openBillingPortal.mockResolvedValue({ url: 'https://billing.stripe.test/p_1' })

    const res = (await POST(req({ returnPath: '/donate?church=st-john' })))!

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(m.openBillingPortal).toHaveBeenCalledWith({
      userId: 'u1',
      returnUrl: 'http://localhost/donate?church=st-john',
    })
    expect((await res.json()).result.url).toBe('https://billing.stripe.test/p_1')
  })

  it('defaults to the donate portal when the caller sends no body', async () => {
    m.openBillingPortal.mockResolvedValue({ url: 'https://billing.stripe.test/p_2' })

    const res = (await POST(req()))!

    expect(res.status).toBe(200)
    expect(m.openBillingPortal).toHaveBeenCalledWith({
      userId: 'u1',
      returnUrl: 'http://localhost/donate',
    })
  })

  it('rejects a return path that leaves the donate page or carries a host', async () => {
    for (const payload of [
      { returnPath: 'https://evil.test/donate' },
      { returnPath: '/churches' },
      { returnPath: '//evil.test/donate' },
      { returnPath: '/donate', customerId: 'cus_2' },
    ]) {
      const res = (await POST(req(payload)))!
      expect(res.status).toBe(422)
    }
    expect(m.openBillingPortal).not.toHaveBeenCalled()
  })

  it('maps a disabled integration to 503 DONATIONS_NOT_READY', async () => {
    m.openBillingPortal.mockRejectedValue(
      new NotImplementedError('STRIPE.createBillingPortalSession'),
    )

    const res = (await POST(req()))!

    expect(res.status).toBe(503)
    expect((await res.json()).error_code).toBe('DONATIONS_NOT_READY')
  })

  it('passes a missing active pledge through as 404', async () => {
    m.openBillingPortal.mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'NO_ACTIVE_SUBSCRIPTION',
        details: 'There is no active monthly pledge to manage.',
      }),
    )

    const res = (await POST(req()))!

    expect(res.status).toBe(404)
    expect((await res.json()).error_code).toBe('NO_ACTIVE_SUBSCRIPTION')
  })
})
