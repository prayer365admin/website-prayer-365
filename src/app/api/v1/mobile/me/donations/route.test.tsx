// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({ requiredAuth: vi.fn(), getMyActiveGift: vi.fn() }))

vi.mock('@/utils/required-auth', () => ({ default: m.requiredAuth }))
vi.mock('@/controller/donation', () => ({ getMyActiveGift: m.getMyActiveGift }))

import { GET } from './route'

const req = () => new NextRequest('http://x/api/v1/mobile/me/donations', { method: 'GET' })

describe('GET /api/v1/mobile/me/donations', () => {
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
    expect(m.getMyActiveGift).not.toHaveBeenCalled()
  })

  it('answers null (200, no-store) when the caller has no active pledge', async () => {
    m.getMyActiveGift.mockResolvedValue(null)

    const res = await GET(req())
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.result).toBeNull()
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(m.getMyActiveGift).toHaveBeenCalledWith({ userId: 'u1' })
  })

  it('projects the pledge with a lower-cased currency and a monthly frequency', async () => {
    m.getMyActiveGift.mockResolvedValue({
      amountMinor: 2500,
      currency: 'EUR',
      churchId: 'c1',
      churchName: "St. John's",
    })

    const res = await GET(req())
    const payload = await res.json()

    expect(payload.result).toEqual({
      churchId: 'c1',
      churchName: "St. John's",
      amountMinor: 2500,
      currency: 'eur',
      frequency: 'monthly',
    })
    expect(Object.keys(payload.result).sort()).toEqual([
      'amountMinor',
      'churchId',
      'churchName',
      'currency',
      'frequency',
    ])
  })
})
