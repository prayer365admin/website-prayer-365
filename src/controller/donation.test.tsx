import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralError } from '@/utils/general-error'

vi.mock('@/providers/donation', () => ({
  GET_DONATIONS: vi.fn(),
  GET_DONATION_SUBSCRIPTIONS: vi.fn(),
  GET_DONATION_SUMMARY: vi.fn(),
}))

import {
  GET_DONATIONS,
  GET_DONATION_SUBSCRIPTIONS,
  GET_DONATION_SUMMARY,
} from '@/providers/donation'
import { listDonations, listDonationSubscriptions, getDonationSummary } from './donation'

const churchIds = new Set(['c1'])
const baseQuery = {
  page: 1,
  limit: 25,
  order_by: 'paid_at' as const,
  order_direction: 'desc' as const,
}
const from = new Date('2026-09-01T00:00:00Z')

beforeEach(() => vi.resetAllMocks())

describe('listDonations', () => {
  it('delegates a church-scoped bounded read to the provider', async () => {
    vi.mocked(GET_DONATIONS).mockResolvedValue({ result: [], total: 0 } as never)
    const res = await listDonations({ churchId: 'c1', churchIds, query: { ...baseQuery, from } })
    expect(res.total).toBe(0)
    expect(GET_DONATIONS).toHaveBeenCalledWith(
      expect.objectContaining({ churchIds, query: expect.objectContaining({ from, page: 1 }) }),
    )
  })

  it('hides a cross-church target with 404 (no existence leak)', async () => {
    await expect(
      listDonations({ churchId: 'other', churchIds, query: baseQuery }),
    ).rejects.toBeInstanceOf(GeneralError)
    await expect(
      listDonations({ churchId: 'other', churchIds, query: baseQuery }),
    ).rejects.toMatchObject({ code: 404 })
    expect(GET_DONATIONS).not.toHaveBeenCalled()
  })
})

describe('listDonationSubscriptions', () => {
  it('delegates the read-only subscription list', async () => {
    vi.mocked(GET_DONATION_SUBSCRIPTIONS).mockResolvedValue({ result: [], total: 0 } as never)
    const res = await listDonationSubscriptions({
      churchId: 'c1',
      churchIds,
      query: {
        page: 1,
        limit: 25,
        order_by: 'created_at' as const,
        order_direction: 'asc' as const,
      },
    })
    expect(res.total).toBe(0)
    expect(GET_DONATION_SUBSCRIPTIONS).toHaveBeenCalledWith(expect.objectContaining({ churchIds }))
  })

  it('hides a cross-church target with 404', async () => {
    await expect(
      listDonationSubscriptions({
        churchId: 'other',
        churchIds,
        query: {
          page: 1,
          limit: 25,
          order_by: 'created_at' as const,
          order_direction: 'asc' as const,
        },
      }),
    ).rejects.toMatchObject({ code: 404 })
  })
})

describe('getDonationSummary', () => {
  it('delegates the per-currency monthly summary for a church in scope', async () => {
    vi.mocked(GET_DONATION_SUMMARY).mockResolvedValue({ month: '2026-09', currencies: [] } as never)
    const res = await getDonationSummary({ churchId: 'c1', churchIds, month: '2026-09' })
    expect(res.month).toBe('2026-09')
    expect(GET_DONATION_SUMMARY).toHaveBeenCalledWith({ churchIds, month: '2026-09' })
  })

  it('hides a cross-church target with 404', async () => {
    await expect(
      getDonationSummary({ churchId: 'other', churchIds, month: '2026-09' }),
    ).rejects.toMatchObject({ code: 404 })
  })
})
