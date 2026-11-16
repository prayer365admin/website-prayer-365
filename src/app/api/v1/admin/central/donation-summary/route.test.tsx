// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/donation', () => ({ getPlatformDonationSummary: vi.fn() }))

import { getPlatformDonationSummary } from '@/controller/donation'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { GET } from './route'

const req = (search = '?month=2026-11') =>
  new NextRequest(`http://localhost/api/v1/admin/central/donation-summary${search}`)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requiredAuth).mockResolvedValue({ session: { user: { user_id: 'admin' } } } as never)
  vi.mocked(requiredScope).mockResolvedValue({ churchIds: new Set() } as never)
})

describe('GET /admin/central/donation-summary', () => {
  it('returns the platform month summary at central scope, never cached', async () => {
    vi.mocked(getPlatformDonationSummary).mockResolvedValue({
      month: '2026-11',
      currencies: [{ currency: 'EUR', grossMinor: '1000', refundedMinor: '0', netMinor: '1000' }],
    })

    const res = await GET(req())

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(getPlatformDonationSummary).toHaveBeenCalledWith({ month: '2026-11' })
    expect(await res.json()).toMatchObject({
      result: { month: '2026-11', currencies: [{ currency: 'EUR', netMinor: '1000' }] },
    })
  })

  it('422s a missing month without reading anything', async () => {
    const res = await GET(req(''))

    expect(res.status).toBe(422)
    expect((await res.json()).error_code).toBe('INVALID_MONTH')
    expect(getPlatformDonationSummary).not.toHaveBeenCalled()
  })
})
