// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/donation', () => ({ listPlatformDonations: vi.fn() }))

import { listPlatformDonations } from '@/controller/donation'
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

const req = (search = '') =>
  new NextRequest(`http://localhost/api/v1/admin/central/donations${search}`)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requiredAuth).mockResolvedValue({ session: { user: { user_id: 'admin' } } } as never)
  vi.mocked(requiredScope).mockResolvedValue({ churchIds: new Set() } as never)
})

describe('GET /admin/central/donations', () => {
  it('reads the platform ledger at central scope and is never cached', async () => {
    vi.mocked(listPlatformDonations).mockResolvedValue({
      result: [
        {
          id: 'd1',
          amountMinor: '1000',
          currency: 'EUR',
          status: 'PAID',
          paidAt: new Date('2026-11-13T06:26:42.000Z'),
          createdAt: new Date('2026-11-13T06:26:47.000Z'),
          ref: 'pi_1',
        },
      ],
      total: 1,
    } as never)

    const res = await GET(req())

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(requiredScope).toHaveBeenCalledWith({
      userId: 'admin',
      central: true,
      subject: 'prayer_donation',
      action: 'read',
    })
    expect(await res.json()).toMatchObject({ total: 1, result: [{ id: 'd1' }] })
  })

  it('passes the range and currency filters through', async () => {
    vi.mocked(listPlatformDonations).mockResolvedValue({ result: [], total: 0 } as never)

    await GET(req('?from=2026-11-01&to=2026-11-30&currency=eur'))

    expect(listPlatformDonations).toHaveBeenCalledWith({
      query: expect.objectContaining({
        currency: 'eur',
        from: new Date('2026-11-01'),
        to: new Date('2026-11-30'),
      }),
    })
  })

  it('403s a caller without central donation read', async () => {
    vi.mocked(requiredScope).mockRejectedValue(NO_SCOPE)

    const res = await GET(req())

    expect(res.status).toBe(403)
    expect(listPlatformDonations).not.toHaveBeenCalled()
  })

  it('401s an unauthenticated caller', async () => {
    vi.mocked(requiredAuth).mockRejectedValue(UNAUTH)

    const res = await GET(req())

    expect(res.status).toBe(401)
  })
})
