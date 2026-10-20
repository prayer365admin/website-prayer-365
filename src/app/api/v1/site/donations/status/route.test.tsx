// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  getDonationStatus: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('@/controller/donation', () => ({ getDonationStatus: m.getDonationStatus }))

import { GET } from './route'

const query = 'sessionId=cs_1&churchId=c1&amountMinor=1000&currency=EUR&frequency=monthly'

const req = (search = query) =>
  new NextRequest(`http://localhost/api/v1/site/donations/status?${search}`)

describe('GET /api/v1/site/donations/status', () => {
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

    const res = await GET(req())

    expect(res.status).toBe(401)
    expect(m.getDonationStatus).not.toHaveBeenCalled()
  })

  it('reads the attempt for the session user and marks the response private', async () => {
    m.getDonationStatus.mockResolvedValue({
      state: 'pending',
      churchId: 'c1',
      churchName: 'St. John',
      amountMinor: 1000,
      currency: 'EUR',
      frequency: 'monthly',
      paidAt: null,
      receiptSeen: false,
    })

    const res = (await GET(req()))!

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(m.getDonationStatus).toHaveBeenCalledWith({
      userId: 'u1',
      query: {
        sessionId: 'cs_1',
        churchId: 'c1',
        amountMinor: 1000,
        currency: 'eur',
        frequency: 'monthly',
      },
    })
    expect((await res.json()).result.state).toBe('pending')
  })

  it('returns 422 when the attempt shape is incomplete', async () => {
    const res = (await GET(req('churchId=c1')))!

    expect(res.status).toBe(422)
    expect(m.getDonationStatus).not.toHaveBeenCalled()
  })
})
