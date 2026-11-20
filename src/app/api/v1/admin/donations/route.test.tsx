// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/donation', () => ({ listAllDonations: vi.fn() }))

import { listAllDonations } from '@/controller/donation'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

const UNAUTH = new GeneralError({
  code: 401,
  error: 'Not Authenticated!',
  error_code: 'UNAUTHORIZED',
  details: 'Please login and try again!',
})
const NO_SCOPE = new GeneralError({
  code: 403,
  error: 'UNAUTHORIZED',
  error_code: 'NOT_ALLOWED',
  details: 'This account is not allowed for this action.',
})
const NOT_READY = new GeneralError({
  code: 503,
  error: 'SERVICE_UNAVAILABLE',
  error_code: 'DONATIONS_NOT_READY',
  details: 'Donations are not ready yet.',
})

const req = (search = '') => new NextRequest(`http://localhost/api/v1/admin/donations${search}`)

const prayerRow = {
  id: 'd1',
  amountMinor: '500',
  currency: 'EUR',
  status: 'PAID',
  paidAt: new Date('2026-11-13T06:26:42.000Z'),
  createdAt: new Date('2026-11-13T06:26:47.000Z'),
  ref: 'pi_1',
  churchId: 'p1',
  churchName: 'Prayer 365',
  type: 'PRAYER',
  refundedMinor: '0',
  donor: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requiredAuth).mockResolvedValue({ session: { user: { user_id: 'admin' } } } as never)
  vi.mocked(requiredScope).mockResolvedValue({ churchIds: new Set(['c1']) } as never)
  vi.mocked(listAllDonations).mockResolvedValue({ result: [prayerRow], total: 1 } as never)
})

describe('GET /admin/donations', () => {
  it('reads every church at central scope and is never cached', async () => {
    const res = await GET(req())

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(requiredScope).toHaveBeenCalledWith({
      userId: 'admin',
      central: true,
      subject: 'prayer_donation',
      action: 'read',
    })
    expect(listAllDonations).toHaveBeenCalledWith(
      expect.objectContaining({ churchIds: new Set(['c1']) }),
    )
    expect(await res.json()).toMatchObject({
      total: 1,
      result: [{ id: 'd1', type: 'PRAYER', donor: null }],
    })
  })

  it('passes the range, status, currency and church filters through', async () => {
    await GET(req('?from=2026-11-01&to=2026-11-30&status=REFUNDED&currency=eur&churchId=c1'))

    expect(listAllDonations).toHaveBeenCalledWith({
      churchIds: new Set(['c1']),
      query: expect.objectContaining({
        from: new Date('2026-11-01'),
        to: new Date('2026-11-30'),
        status: 'REFUNDED',
        currency: 'eur',
        churchId: 'c1',
      }),
    })
  })

  it('400s a status outside the ledger states without reading the ledger', async () => {
    const res = await GET(req('?status=pending'))

    expect(res.status).toBe(400)
    expect((await res.json()).error_code).toBe('INVALID_STATUS')
    expect(listAllDonations).not.toHaveBeenCalled()
  })

  it('404s a church outside the caller scope', async () => {
    vi.mocked(listAllDonations).mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'Church not found.',
      }),
    )

    const res = await GET(req('?churchId=other'))

    expect(res.status).toBe(404)
  })

  it('403s a caller without central donation read', async () => {
    vi.mocked(requiredScope).mockRejectedValue(NO_SCOPE)

    const res = await GET(req())

    expect(res.status).toBe(403)
    expect(listAllDonations).not.toHaveBeenCalled()
  })

  it('401s an unauthenticated caller', async () => {
    vi.mocked(requiredAuth).mockRejectedValue(UNAUTH)

    const res = await GET(req())

    expect(res.status).toBe(401)
  })

  it('503s when the platform beneficiary is missing (seed not run)', async () => {
    vi.mocked(listAllDonations).mockRejectedValue(NOT_READY)

    const res = await GET(req())

    expect(res.status).toBe(503)
    expect((await res.json()).error_code).toBe('DONATIONS_NOT_READY')
  })
})
