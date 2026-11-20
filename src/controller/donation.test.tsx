import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralError } from '@/utils/general-error'

vi.mock('@/providers/donation', () => ({
  GET_DONATION_BY_PAYMENT_ID: vi.fn(),
  GET_DONATIONS: vi.fn(),
  GET_DONATIONS_ALL_CHURCHES: vi.fn(),
  GET_DONATION_SUBSCRIPTIONS: vi.fn(),
  GET_DONATION_SUMMARY: vi.fn(),
  GET_DONATION_SUMMARY_BY_TYPE: vi.fn(),
  GET_DONATION_SUMMARY_MONTHLY: vi.fn(),
  GET_PLATFORM_CHURCH: vi.fn(),
}))

import {
  GET_DONATIONS,
  GET_DONATIONS_ALL_CHURCHES,
  GET_DONATION_SUBSCRIPTIONS,
  GET_DONATION_SUMMARY,
  GET_DONATION_SUMMARY_BY_TYPE,
  GET_DONATION_SUMMARY_MONTHLY,
  GET_PLATFORM_CHURCH,
} from '@/providers/donation'
import {
  listDonations,
  listDonationSubscriptions,
  getDonationSummary,
  listAllDonations,
  listAllDonationSubscriptions,
  getDonationSummaryByType,
  getDonationSummaryMonthly,
} from './donation'

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

const PLATFORM = { id: 'p1', name: 'Prayer 365' }

beforeEach(() => {
  vi.mocked(GET_PLATFORM_CHURCH).mockResolvedValue(PLATFORM as never)
  vi.mocked(GET_DONATIONS_ALL_CHURCHES).mockResolvedValue({ result: [], total: 0 } as never)
  vi.mocked(GET_DONATION_SUMMARY_BY_TYPE).mockResolvedValue({
    from: new Date(0),
    to: new Date(0),
    currencies: [],
  } as never)
})

describe('listAllDonations', () => {
  it('reads every church in scope with the platform row unioned in', async () => {
    await listAllDonations({ churchIds, query: baseQuery })

    expect(GET_DONATIONS_ALL_CHURCHES).toHaveBeenCalledWith({
      churchIds,
      platformChurchId: PLATFORM.id,
      query: baseQuery,
    })
  })

  it('narrows to one in-scope church when the filter names it', async () => {
    await listAllDonations({ churchIds, query: { ...baseQuery, churchId: 'c1' } })

    expect(GET_DONATIONS_ALL_CHURCHES).toHaveBeenCalledWith({
      churchIds: new Set(['c1']),
      platformChurchId: PLATFORM.id,
      query: expect.objectContaining({ churchId: 'c1' }),
    })
  })

  it('allows the platform church as an explicit filter even outside the scope walk', async () => {
    await listAllDonations({ churchIds, query: { ...baseQuery, churchId: PLATFORM.id } })

    expect(GET_DONATIONS_ALL_CHURCHES).toHaveBeenCalledWith({
      churchIds: new Set([PLATFORM.id]),
      platformChurchId: PLATFORM.id,
      query: expect.objectContaining({ churchId: PLATFORM.id }),
    })
  })

  it('hides a foreign church with 404 and never reads the ledger', async () => {
    await expect(
      listAllDonations({ churchIds, query: { ...baseQuery, churchId: 'other' } }),
    ).rejects.toMatchObject({ code: 404, error_code: 'RESOURCE_NOT_FOUND' })
    expect(GET_DONATIONS_ALL_CHURCHES).not.toHaveBeenCalled()
  })

  it('503s rather than reporting an empty ledger when the platform row is missing', async () => {
    vi.mocked(GET_PLATFORM_CHURCH).mockResolvedValue(null)

    await expect(listAllDonations({ churchIds, query: baseQuery })).rejects.toMatchObject({
      code: 503,
      error_code: 'DONATIONS_NOT_READY',
    })
    expect(GET_DONATIONS_ALL_CHURCHES).not.toHaveBeenCalled()
  })
})

describe('getDonationSummaryByType', () => {
  const fromDate = new Date('2026-11-01T00:00:00Z')
  const toDate = new Date('2026-11-30T23:59:59.999Z')

  it('sums every church in scope with the platform row unioned in', async () => {
    await getDonationSummaryByType({ churchIds, from: fromDate, to: toDate })

    expect(GET_DONATION_SUMMARY_BY_TYPE).toHaveBeenCalledWith({
      churchIds,
      platformChurchId: PLATFORM.id,
      from: fromDate,
      to: toDate,
    })
  })

  it('narrows to one in-scope church when the filter names it', async () => {
    await getDonationSummaryByType({ churchIds, churchId: 'c1' })

    expect(GET_DONATION_SUMMARY_BY_TYPE).toHaveBeenCalledWith(
      expect.objectContaining({ churchIds: new Set(['c1']), platformChurchId: PLATFORM.id }),
    )
  })

  it('allows the platform church as an explicit filter', async () => {
    await getDonationSummaryByType({ churchIds, churchId: PLATFORM.id })

    expect(GET_DONATION_SUMMARY_BY_TYPE).toHaveBeenCalledWith(
      expect.objectContaining({ churchIds: new Set([PLATFORM.id]) }),
    )
  })

  it('hides a foreign church with 404', async () => {
    await expect(getDonationSummaryByType({ churchIds, churchId: 'other' })).rejects.toMatchObject({
      code: 404,
      error_code: 'RESOURCE_NOT_FOUND',
    })
    expect(GET_DONATION_SUMMARY_BY_TYPE).not.toHaveBeenCalled()
  })

  it('503s when the platform beneficiary is missing', async () => {
    vi.mocked(GET_PLATFORM_CHURCH).mockResolvedValue(null)

    await expect(getDonationSummaryByType({ churchIds })).rejects.toMatchObject({
      code: 503,
      error_code: 'DONATIONS_NOT_READY',
    })
  })
})

describe('listAllDonationSubscriptions', () => {
  const query = {
    page: 1,
    limit: 25,
    order_by: 'created_at' as const,
    order_direction: 'desc' as const,
  }

  beforeEach(() => {
    vi.mocked(GET_DONATION_SUBSCRIPTIONS).mockResolvedValue({ result: [], total: 0 } as never)
  })

  it('unions the platform beneficiary into the all-church set', async () => {
    await listAllDonationSubscriptions({ churchIds, query })

    expect(GET_DONATION_SUBSCRIPTIONS).toHaveBeenCalledWith(
      expect.objectContaining({ churchIds: new Set(['c1', 'p1']) }),
    )
  })

  it('narrows to one in-scope church when the filter names it', async () => {
    await listAllDonationSubscriptions({ churchIds, query: { ...query, churchId: 'c1' } })

    expect(GET_DONATION_SUBSCRIPTIONS).toHaveBeenCalledWith(
      expect.objectContaining({ churchIds: new Set(['c1']) }),
    )
  })

  it('allows the platform church as an explicit filter', async () => {
    await listAllDonationSubscriptions({ churchIds, query: { ...query, churchId: 'p1' } })

    expect(GET_DONATION_SUBSCRIPTIONS).toHaveBeenCalledWith(
      expect.objectContaining({ churchIds: new Set(['p1']) }),
    )
  })

  it('hides a foreign church with 404 and never reads the ledger', async () => {
    await expect(
      listAllDonationSubscriptions({ churchIds, query: { ...query, churchId: 'other' } }),
    ).rejects.toMatchObject({ code: 404 })
    expect(GET_DONATION_SUBSCRIPTIONS).not.toHaveBeenCalled()
  })

  it('503s when the platform beneficiary is missing', async () => {
    vi.mocked(GET_PLATFORM_CHURCH).mockResolvedValue(null as never)

    await expect(listAllDonationSubscriptions({ churchIds, query })).rejects.toMatchObject({
      code: 503,
    })
    expect(GET_DONATION_SUBSCRIPTIONS).not.toHaveBeenCalled()
  })
})

describe('getDonationSummaryMonthly', () => {
  beforeEach(() => {
    vi.mocked(GET_DONATION_SUMMARY_MONTHLY).mockResolvedValue([] as never)
  })

  it('reads every church in scope for the requested window', async () => {
    const from = new Date('2026-01-01T00:00:00Z')
    const to = new Date('2026-11-30T23:59:59Z')

    await getDonationSummaryMonthly({ churchIds, from, to })

    expect(GET_DONATION_SUMMARY_MONTHLY).toHaveBeenCalledWith({ churchIds, from, to })
  })

  it('narrows to the platform church when it is the explicit filter', async () => {
    await getDonationSummaryMonthly({ churchIds, churchId: 'p1' })

    expect(GET_DONATION_SUMMARY_MONTHLY).toHaveBeenCalledWith(
      expect.objectContaining({ churchIds: new Set(['p1']) }),
    )
  })

  it('hides a foreign church with 404', async () => {
    await expect(getDonationSummaryMonthly({ churchIds, churchId: 'other' })).rejects.toMatchObject(
      { code: 404 },
    )
    expect(GET_DONATION_SUMMARY_MONTHLY).not.toHaveBeenCalled()
  })

  it('503s when the platform beneficiary is missing', async () => {
    vi.mocked(GET_PLATFORM_CHURCH).mockResolvedValue(null as never)

    await expect(getDonationSummaryMonthly({ churchIds })).rejects.toMatchObject({ code: 503 })
  })
})
