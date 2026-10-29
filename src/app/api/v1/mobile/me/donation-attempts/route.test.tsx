// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({ requiredAuth: vi.fn(), getDonationStatus: vi.fn() }))

vi.mock('@/utils/required-auth', () => ({ default: m.requiredAuth }))
vi.mock('@/controller/donation', () => ({ getDonationStatus: m.getDonationStatus }))

import { GET } from './route'

const QS =
  'sessionId=cs_1&churchId=01a0f73b-7860-75cc-a58d-febcab0ac0f7&amountMinor=2500&currency=EUR&frequency=one_time'
const req = (qs: string = QS) =>
  new NextRequest(`http://x/api/v1/mobile/me/donation-attempts?${qs}`)

describe('GET /api/v1/mobile/me/donation-attempts', () => {
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
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(m.getDonationStatus).not.toHaveBeenCalled()
  })

  it('reads the caller’s own attempt and never caches the answer', async () => {
    m.getDonationStatus.mockResolvedValue({
      state: 'confirmed',
      churchId: 'c1',
      churchSlug: 'tallinn-demo-church',
      churchName: 'Tallinn Demo Church',
      amountMinor: 2500,
      currency: 'eur',
      frequency: 'one_time',
      paidAt: new Date('2026-10-24T10:00:00.000Z'),
      receiptSeen: true,
    })

    const res = await GET(req())
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.result.state).toBe('confirmed')
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(m.getDonationStatus).toHaveBeenCalledWith({
      userId: 'u1',
      query: expect.objectContaining({
        churchId: '01a0f73b-7860-75cc-a58d-febcab0ac0f7',
        amountMinor: 2500,
        currency: 'eur',
        frequency: 'one_time',
        sessionId: 'cs_1',
      }),
    })
  })

  it('rejects a query without sessionId with 422', async () => {
    const res = await GET(req('churchId=c1&amountMinor=2500&currency=EUR&frequency=one_time'))
    expect(res.status).toBe(422)
    expect(m.getDonationStatus).not.toHaveBeenCalled()
  })

  it('surfaces CHURCH_NOT_FOUND', async () => {
    m.getDonationStatus.mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'CHURCH_NOT_FOUND',
        details: 'Church not found.',
      }),
    )
    const res = await GET(req())
    const payload = await res.json()
    expect(res.status).toBe(404)
    expect(payload.error_code).toBe('CHURCH_NOT_FOUND')
  })
})
