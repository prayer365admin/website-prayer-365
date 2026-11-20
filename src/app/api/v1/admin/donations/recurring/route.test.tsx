// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/donation', () => ({ listAllDonationSubscriptions: vi.fn() }))

import { listAllDonationSubscriptions } from '@/controller/donation'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

const req = (search = '') =>
  new NextRequest(`http://localhost/api/v1/admin/donations/recurring${search}`)

const row = {
  id: 's1',
  amountMinor: '2000',
  currency: 'EUR',
  providerStatus: 'active',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  churchId: 'c1',
  churchName: 'Hope Church',
  frequency: 'Monthly',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requiredAuth).mockResolvedValue({ session: { user: { user_id: 'admin' } } } as never)
  vi.mocked(requiredScope).mockResolvedValue({ churchIds: new Set(['c1']) } as never)
  vi.mocked(listAllDonationSubscriptions).mockResolvedValue({ result: [row], total: 1 } as never)
})

describe('GET /admin/donations/recurring', () => {
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
    expect(await res.json()).toMatchObject({
      result: [{ id: 's1', churchId: 'c1', churchName: 'Hope Church', frequency: 'Monthly' }],
      total: 1,
    })
  })

  it('lowercases the currency filter and passes the church filter through', async () => {
    await GET(req('?currency=EUR&churchId=c1&page=2&limit=10'))

    expect(listAllDonationSubscriptions).toHaveBeenCalledWith({
      churchIds: new Set(['c1']),
      query: {
        page: 2,
        limit: 10,
        order_by: 'created_at',
        order_direction: 'desc',
        currency: 'eur',
        churchId: 'c1',
      },
    })
  })

  it('404s a church outside the grant without reading the ledger', async () => {
    vi.mocked(listAllDonationSubscriptions).mockRejectedValue(
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
    expect(listAllDonationSubscriptions).not.toHaveBeenCalled()
  })

  it('400s an unsupported order_by', async () => {
    const res = await GET(req('?order_by=provider_status'))

    expect(res.status).toBe(400)
    expect(listAllDonationSubscriptions).not.toHaveBeenCalled()
  })

  it('503s when the platform beneficiary is missing (seed not run)', async () => {
    vi.mocked(listAllDonationSubscriptions).mockRejectedValue(
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
