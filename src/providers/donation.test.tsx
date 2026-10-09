import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/db-connection', () => ({
  db: {
    $transaction: vi.fn(async (calls: Array<Promise<unknown>>) => Promise.all(calls)),
    donation: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    donationSubscription: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { db } from '@/utils/db-connection'
import { GET_DONATIONS, GET_DONATION_SUBSCRIPTIONS, GET_DONATION_SUMMARY } from './donation'

const scope = new Set(['c1'])

beforeEach(() => vi.resetAllMocks())

describe('GET_DONATION_SUMMARY', () => {
  it('groups per currency and NEVER sums across currencies (net = gross - refunded per row)', async () => {
    vi.mocked(db.donation.groupBy).mockResolvedValue([
      { currency: 'USD', _sum: { amount_minor: BigInt(5000), refunded_minor: BigInt(1000) } },
      { currency: 'IDR', _sum: { amount_minor: BigInt(200000), refunded_minor: BigInt(0) } },
    ] as never)

    const res = await GET_DONATION_SUMMARY({ churchIds: scope, month: '2026-09' })
    expect(res.month).toBe('2026-09')
    // Two independent per-currency rows; no combined / cross-currency total exists.
    expect(res.currencies).toHaveLength(2)
    expect(res.currencies).toEqual([
      { currency: 'IDR', grossMinor: '200000', refundedMinor: '0', netMinor: '200000' },
      { currency: 'USD', grossMinor: '5000', refundedMinor: '1000', netMinor: '4000' },
    ])
  })

  it('scopes the groupBy to the resolved church set and the calendar month', async () => {
    vi.mocked(db.donation.groupBy).mockResolvedValue([] as never)
    await GET_DONATION_SUMMARY({ churchIds: scope, month: '2026-09' })
    const g = vi.mocked(db.donation.groupBy).mock.calls[0]![0]
    const where = g.where as {
      church_id: { in: string[] }
      paid_at?: { gte?: Date; lt?: Date }
    }
    expect(where.church_id.in).toEqual(['c1'])
    // 2026-09-01T00:00:00Z <= paid_at < 2026-10-01T00:00:00Z
    expect(where.paid_at?.gte?.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(where.paid_at?.lt?.toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })

  it('rejects invalid months with INVALID_MONTH 422 and never calls db.donation.groupBy', async () => {
    for (const invalidMonth of ['2026-13', '2026-00', 'abc']) {
      await expect(
        GET_DONATION_SUMMARY({ churchIds: scope, month: invalidMonth }),
      ).rejects.toMatchObject({
        code: 422,
        error_code: 'INVALID_MONTH',
      })
      expect(db.donation.groupBy).not.toHaveBeenCalled()
    }
  })
})

describe('GET_DONATIONS', () => {
  const query = {
    page: 1,
    limit: 25,
    order_by: 'paid_at' as const,
    order_direction: 'desc' as const,
  }

  it('filters count AND rows by the church set and from/to bounds, omitting donor PII', async () => {
    vi.mocked(db.donation.count).mockResolvedValue(1)
    vi.mocked(db.donation.findMany).mockResolvedValue([
      {
        id: 'd1',
        amount_minor: BigInt(1000),
        currency: 'USD',
        status: 'PAID',
        paid_at: new Date('2026-09-05T00:00:00Z'),
        provider_payment_id: 'pi_1',
      },
    ] as never)

    const res = await GET_DONATIONS({
      churchIds: scope,
      query: {
        ...query,
        from: new Date('2026-09-01T00:00:00Z'),
        to: new Date('2026-09-30T00:00:00Z'),
      },
    })
    expect(res.total).toBe(1)
    // DTO carries only amount/currency/status/date/ref — no user_id / subscription / donor columns.
    expect(res.result[0]).toEqual({
      id: 'd1',
      amountMinor: '1000',
      currency: 'USD',
      status: 'PAID',
      paidAt: new Date('2026-09-05T00:00:00Z'),
      ref: 'pi_1',
    })

    const call = vi.mocked(db.donation.findMany).mock.calls[0]![0]!
    const where = call.where as {
      church_id: { in: string[] }
      paid_at?: { gte?: Date; lte?: Date }
    }
    expect(where.church_id.in).toEqual(['c1'])
    expect(where.paid_at?.gte?.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(where.paid_at?.lte?.toISOString()).toBe('2026-09-30T00:00:00.000Z')
  })
  it('filters by normalized currency when requested', async () => {
    vi.mocked(db.donation.count).mockResolvedValue(1)
    vi.mocked(db.donation.findMany).mockResolvedValue([
      {
        id: 'd1',
        amount_minor: BigInt(1000),
        currency: 'usd',
        status: 'PAID',
        paid_at: new Date('2026-09-05T00:00:00Z'),
        provider_payment_id: 'pi_1',
      },
    ] as never)

    await GET_DONATIONS({
      churchIds: scope,
      query: { ...query, currency: 'USD' },
    })

    const call = vi.mocked(db.donation.findMany).mock.calls[0]![0]!
    const where = call.where as { currency?: string }
    expect(where.currency).toBe('usd')
  })

  it('returns empty without querying when the scope resolves no churches', async () => {
    const res = await GET_DONATIONS({ churchIds: new Set(), query })
    expect(res).toEqual({ result: [], total: 0 })
    expect(db.donation.count).not.toHaveBeenCalled()
  })
})

describe('GET_DONATION_SUBSCRIPTIONS', () => {
  it('lists recurring rows without editing fields and scoped to the church', async () => {
    vi.mocked(db.donationSubscription.count).mockResolvedValue(1)
    vi.mocked(db.donationSubscription.findMany).mockResolvedValue([
      {
        id: 's1',
        amount_minor: BigInt(2000),
        currency: 'USD',
        provider_status: 'active',
        created_at: new Date('2026-08-01T00:00:00Z'),
      },
    ] as never)

    const res = await GET_DONATION_SUBSCRIPTIONS({
      churchIds: scope,
      query: {
        page: 1,
        limit: 25,
        order_by: 'created_at' as const,
        order_direction: 'desc' as const,
      },
    })
    expect(res.result[0]).toEqual({
      id: 's1',
      amountMinor: '2000',
      currency: 'USD',
      providerStatus: 'active',
      createdAt: new Date('2026-08-01T00:00:00Z'),
    })
    const call = vi.mocked(db.donationSubscription.findMany).mock.calls[0]![0]!
    const where = call.where as { church_id: { in: string[] } }
    expect(where.church_id.in).toEqual(['c1'])
  })
  it('filters subscriptions by normalized currency when requested', async () => {
    vi.mocked(db.donationSubscription.count).mockResolvedValue(1)
    vi.mocked(db.donationSubscription.findMany).mockResolvedValue([] as never)

    await GET_DONATION_SUBSCRIPTIONS({
      churchIds: scope,
      query: {
        page: 1,
        limit: 25,
        order_by: 'created_at' as const,
        order_direction: 'desc' as const,
        currency: 'EUR',
      },
    })

    const call = vi.mocked(db.donationSubscription.findMany).mock.calls[0]![0]!
    const where = call.where as { currency?: string }
    expect(where.currency).toBe('eur')
  })
})
