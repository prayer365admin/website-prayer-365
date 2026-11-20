// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/donation', () => ({ getDonationSummaryByType: vi.fn() }))

import { getDonationSummaryByType } from '@/controller/donation'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

const req = (search = '') =>
  new NextRequest(`http://localhost/api/v1/admin/donations/summary${search}`)

const summary = {
  from: new Date('2026-11-01T00:00:00.000Z'),
  to: new Date('2026-11-30T23:59:59.999Z'),
  currencies: [
    {
      currency: 'EUR',
      total: { grossMinor: '1500', refundedMinor: '0', netMinor: '1500', count: 2 },
      church: { grossMinor: '1000', refundedMinor: '0', netMinor: '1000', count: 1 },
      prayer: { grossMinor: '500', refundedMinor: '0', netMinor: '500', count: 1 },
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requiredAuth).mockResolvedValue({ session: { user: { user_id: 'admin' } } } as never)
  vi.mocked(requiredScope).mockResolvedValue({ churchIds: new Set(['c1']) } as never)
  vi.mocked(getDonationSummaryByType).mockResolvedValue(summary as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /admin/donations/summary', () => {
  it('returns the three buckets at central scope, never cached', async () => {
    const res = await GET(req())

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(requiredScope).toHaveBeenCalledWith({
      userId: 'admin',
      central: true,
      subject: 'prayer_donation',
      action: 'read',
    })
    expect(await res.json()).toMatchObject({
      result: { currencies: [{ currency: 'EUR', prayer: { netMinor: '500', count: 1 } }] },
    })
  })

  it('defaults to the current UTC month when no range is given', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-17T09:30:00.000Z'))

    await GET(req())

    expect(getDonationSummaryByType).toHaveBeenCalledWith({
      churchIds: new Set(['c1']),
      from: new Date('2026-11-01T00:00:00.000Z'),
      to: new Date('2026-11-30T23:59:59.999Z'),
      churchId: undefined,
    })
  })

  it('passes an explicit range and church filter through', async () => {
    await GET(req('?from=2026-10-01&to=2026-10-31&churchId=p1'))

    expect(getDonationSummaryByType).toHaveBeenCalledWith({
      churchIds: new Set(['c1']),
      from: new Date('2026-10-01'),
      to: new Date('2026-10-31'),
      churchId: 'p1',
    })
  })

  it('422s a reversed date range without reading the ledger', async () => {
    const res = await GET(req('?from=2026-11-30&to=2026-11-01'))

    expect(res.status).toBe(422)
    expect(getDonationSummaryByType).not.toHaveBeenCalled()
  })

  it('403s a caller without central donation read', async () => {
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'This account is not allowed for this action.',
      }),
    )

    const res = await GET(req())

    expect(res.status).toBe(403)
    expect(getDonationSummaryByType).not.toHaveBeenCalled()
  })

  it('401s an unauthenticated caller', async () => {
    vi.mocked(requiredAuth).mockRejectedValue(
      new GeneralError({
        code: 401,
        error: 'Not Authenticated!',
        error_code: 'UNAUTHORIZED',
        details: 'Please login and try again!',
      }),
    )

    const res = await GET(req())

    expect(res.status).toBe(401)
  })

  it('503s when the platform beneficiary is missing (seed not run)', async () => {
    vi.mocked(getDonationSummaryByType).mockRejectedValue(
      new GeneralError({
        code: 503,
        error: 'SERVICE_UNAVAILABLE',
        error_code: 'DONATIONS_NOT_READY',
        details: 'Donations are not ready yet.',
      }),
    )

    const res = await GET(req())

    expect(res.status).toBe(503)
  })
})
