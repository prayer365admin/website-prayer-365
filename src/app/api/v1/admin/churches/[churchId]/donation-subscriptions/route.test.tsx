// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/donation', () => ({ listDonationSubscriptions: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { listDonationSubscriptions } from '@/controller/donation'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const scope = () => ({
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
})
const params = { params: Promise.resolve({ churchId: 'c1' }) }
const sub = {
  id: 's1',
  amountMinor: '2000',
  currency: 'USD',
  providerStatus: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
}

describe('GET /api/v1/admin/churches/[churchId]/donation-subscriptions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns paginated subscription summaries (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope() as never)
    vi.mocked(listDonationSubscriptions).mockResolvedValue({ result: [sub], total: 1 } as never)

    const res = (await GET(
      new NextRequest('http://localhost/api/v1/admin/churches/c1/donation-subscriptions'),
      params as never,
    ))!
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(body.result[0]).toEqual(sub)
    expect(requiredScope).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c1', subject: 'prayer_donation', action: 'read' }),
    )
  })
  it('forwards currency filter to listDonationSubscriptions', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope() as never)
    vi.mocked(listDonationSubscriptions).mockResolvedValue({ result: [sub], total: 1 } as never)

    const res = (await GET(
      new NextRequest(
        'http://localhost/api/v1/admin/churches/c1/donation-subscriptions?currency=eur',
      ),
      params as never,
    ))!
    expect(res.status).toBe(200)
    expect(listDonationSubscriptions).toHaveBeenCalledWith(
      expect.objectContaining({
        churchId: 'c1',
        query: expect.objectContaining({ currency: 'eur' }),
      }),
    )
  })

  it('returns 403 when scope is denied', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'Not allowed.',
      }),
    )
    const res = (await GET(
      new NextRequest('http://localhost/api/v1/admin/churches/c1/donation-subscriptions'),
      params as never,
    ))!
    expect(res.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requiredAuth).mockRejectedValue(
      new GeneralError({
        code: 401,
        error: 'Not Authenticated!',
        error_code: 'UNAUTHORIZED',
        details: 'Login required.',
      }),
    )
    const res = (await GET(
      new NextRequest('http://localhost/api/v1/admin/churches/c1/donation-subscriptions'),
      params as never,
    ))!
    expect(res.status).toBe(401)
  })
})
