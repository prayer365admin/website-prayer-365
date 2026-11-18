// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/donation', () => ({ getDonationSummaryMonthly: vi.fn() }))

import { getDonationSummaryMonthly } from '@/controller/donation'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

const req = (search = '') =>
  new NextRequest(`http://localhost/api/v1/admin/donations/summary/monthly${search}`)

const rows = [
  {
    month: '2026-11',
    currency: 'eur',
    grossMinor: '1500',
    refundedMinor: '500',
    netMinor: '1000',
    count: 2,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requiredAuth).mockResolvedValue({ session: { user: { user_id: 'admin' } } } as never)
  vi.mocked(requiredScope).mockResolvedValue({ churchIds: new Set(['c1']) } as never)
  vi.mocked(getDonationSummaryMonthly).mockResolvedValue(rows as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /admin/donations/summary/monthly', () => {
  it('returns one row per month and currency at central scope, never cached', async () => {
    const res = await GET(req())

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(requiredScope).toHaveBeenCalledWith({
      userId: 'admin',
      central: true,
      subject: 'prayer_donation',
      action: 'read',
    })
    expect(await res.json()).toMatchObject({ result: rows })
  })

  it('defaults to the current UTC month when no range is given', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-17T09:30:00.000Z'))

    await GET(req())

    expect(getDonationSummaryMonthly).toHaveBeenCalledWith({
      churchIds: new Set(['c1']),
      from: new Date('2026-11-01T00:00:00.000Z'),
      to: new Date('2026-11-30T23:59:59.999Z'),
      churchId: undefined,
    })
  })

  it('passes an explicit range and church filter through', async () => {
    await GET(req('?from=2026-01-01&to=2026-11-30&churchId=p1'))

    expect(getDonationSummaryMonthly).toHaveBeenCalledWith({
      churchIds: new Set(['c1']),
      from: new Date('2026-01-01'),
      to: new Date('2026-11-30'),
      churchId: 'p1',
    })
  })

  it('422s a reversed date range without reading the ledger', async () => {
    const res = await GET(req('?from=2026-11-30&to=2026-11-01'))

    expect(res.status).toBe(422)
    expect(getDonationSummaryMonthly).not.toHaveBeenCalled()
  })

  it('404s a church outside the grant', async () => {
    vi.mocked(getDonationSummaryMonthly).mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'Church not found.',
      }),
    )

    expect((await GET(req('?churchId=other'))).status).toBe(404)
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

    expect((await GET(req())).status).toBe(401)
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

    expect((await GET(req())).status).toBe(403)
    expect(getDonationSummaryMonthly).not.toHaveBeenCalled()
  })

  it('503s when the platform beneficiary is missing (seed not run)', async () => {
    vi.mocked(getDonationSummaryMonthly).mockRejectedValue(
      new GeneralError({
        code: 503,
        error: 'SERVICE_UNAVAILABLE',
        error_code: 'DONATIONS_NOT_READY',
        details: 'Donations are not ready yet.',
      }),
    )

    expect((await GET(req())).status).toBe(503)
  })
})
