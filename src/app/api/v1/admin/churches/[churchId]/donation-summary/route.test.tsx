// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/donation', () => ({ getDonationSummary: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { getDonationSummary } from '@/controller/donation'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const scope = () => ({
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
})
const params = { params: Promise.resolve({ churchId: 'c1' }) }

describe('GET /api/v1/admin/churches/[churchId]/donation-summary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a per-currency summary for a month (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope() as never)
    vi.mocked(getDonationSummary).mockResolvedValue({
      month: '2026-09',
      currencies: [
        { currency: 'USD', grossMinor: '5000', refundedMinor: '1000', netMinor: '4000' },
      ],
    } as never)

    const res = (await GET(
      new NextRequest('http://localhost/api/v1/admin/churches/c1/donation-summary?month=2026-09'),
      params as never,
    ))!
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.result.currencies[0]).toEqual({
      currency: 'USD',
      grossMinor: '5000',
      refundedMinor: '1000',
      netMinor: '4000',
    })
    expect(requiredScope).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c1', subject: 'prayer_donation', action: 'read' }),
    )
  })

  it('returns 422 when month is missing', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope() as never)
    const res = (await GET(
      new NextRequest('http://localhost/api/v1/admin/churches/c1/donation-summary'),
      params as never,
    ))!
    expect(res.status).toBe(422)
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
      new NextRequest('http://localhost/api/v1/admin/churches/c1/donation-summary?month=2026-09'),
      params as never,
    ))!
    expect(res.status).toBe(403)
  })
})
