import { beforeEach, describe, expect, it, vi } from 'vitest'

const stripeMock = vi.hoisted(() => ({
  retrieveSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  isStripeEnabled: vi.fn(() => false),
}))

vi.mock('./stripe', () => ({
  STRIPE: stripeMock,
  isStripeEnabled: () => stripeMock.isStripeEnabled(),
}))

vi.mock('@/utils/db-connection', () => ({
  db: {
    $transaction: vi.fn(async (calls: Array<Promise<unknown>>) => Promise.all(calls)),
    donation: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    donationSubscription: {
      findUnique: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

import { db } from '@/utils/db-connection'
import {
  GET_DONATIONS,
  GET_DONATION_SUBSCRIPTIONS,
  GET_DONATION_SUMMARY,
  GET_MY_ACTIVE_GIFT,
  CANCEL_OTHER_CHURCH_SUBSCRIPTIONS,
} from './donation'

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
    const where = call.where as unknown as {
      church_id: { in: string[] }
      OR: [
        { paid_at: { gte: Date; lte: Date } },
        { paid_at: null; created_at: { gte: Date; lte: Date } },
      ]
    }
    expect(where.church_id.in).toEqual(['c1'])
    expect(where.OR[0].paid_at.gte.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(where.OR[0].paid_at.lte.toISOString()).toBe('2026-09-30T00:00:00.000Z')
    expect(where.OR[1].paid_at).toBeNull()
    expect(where.OR[1].created_at.gte.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(where.OR[1].created_at.lte.toISOString()).toBe('2026-09-30T00:00:00.000Z')
  })

  it('includes failed donations with null paid_at by falling back to created_at in date bounds', async () => {
    vi.mocked(db.donation.count).mockResolvedValue(1)
    vi.mocked(db.donation.findMany).mockResolvedValue([
      {
        id: 'd-failed',
        amount_minor: BigInt(2500),
        currency: 'USD',
        status: 'FAILED',
        paid_at: null,
        created_at: new Date('2026-09-10T12:00:00Z'),
        provider_payment_id: 'pi_fail_1',
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
    expect(res.result[0]).toEqual({
      id: 'd-failed',
      amountMinor: '2500',
      currency: 'USD',
      status: 'FAILED',
      paidAt: null,
      createdAt: new Date('2026-09-10T12:00:00Z'),
      ref: 'pi_fail_1',
    })
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

describe('GET_MY_ACTIVE_GIFT', () => {
  it("reads only the caller's own active subscription and maps it for Home", async () => {
    vi.mocked(db.donationSubscription.findFirst).mockResolvedValue({
      amount_minor: BigInt(1000),
      currency: 'eur',
      church: { id: 'c1', name: 'Hope Church' },
    } as never)

    const gift = await GET_MY_ACTIVE_GIFT({ userId: 'u1' })

    expect(vi.mocked(db.donationSubscription.findFirst).mock.calls[0][0]?.where).toEqual({
      user_id: 'u1',
      provider_status: 'active',
    })
    expect(gift).toEqual({
      amountMinor: 1000,
      currency: 'EUR',
      churchId: 'c1',
      churchName: 'Hope Church',
    })
  })

  it('returns null without an active gift', async () => {
    vi.mocked(db.donationSubscription.findFirst).mockResolvedValue(null)
    expect(await GET_MY_ACTIVE_GIFT({ userId: 'u1' })).toBeNull()
  })

  it('reconciles with Stripe and marks DB row canceled when canceledAt is set', async () => {
    stripeMock.isStripeEnabled.mockReturnValue(true)
    stripeMock.retrieveSubscription.mockResolvedValue({
      id: 'sub_1',
      status: 'active',
      canceledAt: 1792737150,
      cancelAtPeriodEnd: false,
    })
    vi.mocked(db.donationSubscription.findFirst).mockResolvedValue({
      id: 'sub_row_1',
      provider_subscription_id: 'sub_1',
      amount_minor: BigInt(2500),
      currency: 'eur',
      church: { id: 'c1', name: 'St. John' },
    } as never)

    const gift = await GET_MY_ACTIVE_GIFT({ userId: 'u1' })

    expect(gift).toBeNull()
    expect(db.donationSubscription.update).toHaveBeenCalledWith({
      where: { id: 'sub_row_1' },
      data: { provider_status: 'canceled' },
    })
  })

  it('reconciles with Stripe and marks DB row canceled when status is canceled', async () => {
    stripeMock.isStripeEnabled.mockReturnValue(true)
    stripeMock.retrieveSubscription.mockResolvedValue({
      id: 'sub_2',
      status: 'canceled',
      canceledAt: null,
      cancelAtPeriodEnd: false,
    })
    vi.mocked(db.donationSubscription.findFirst).mockResolvedValue({
      id: 'sub_row_2',
      provider_subscription_id: 'sub_2',
      amount_minor: BigInt(2500),
      currency: 'eur',
      church: { id: 'c1', name: 'St. John' },
    } as never)

    const gift = await GET_MY_ACTIVE_GIFT({ userId: 'u1' })

    expect(gift).toBeNull()
    expect(db.donationSubscription.update).toHaveBeenCalledWith({
      where: { id: 'sub_row_2' },
      data: { provider_status: 'canceled' },
    })
  })
})

describe('CANCEL_OTHER_CHURCH_SUBSCRIPTIONS', () => {
  it('marks prior active subscriptions canceled in DB and cancels them in Stripe', async () => {
    stripeMock.isStripeEnabled.mockReturnValue(true)
    stripeMock.cancelSubscription.mockResolvedValue({ id: 'sub_prior', status: 'canceled' })
    vi.mocked(db.donationSubscription.findMany).mockResolvedValue([
      { id: 'sub_row_1', provider_subscription_id: 'sub_prior' },
    ] as never)

    const canceled = await CANCEL_OTHER_CHURCH_SUBSCRIPTIONS({
      userId: 'u1',
      churchId: 'c1',
      currentSubscriptionId: 'sub_new',
    })

    expect(db.donationSubscription.findMany).toHaveBeenCalledWith({
      where: {
        user_id: 'u1',
        church_id: 'c1',
        provider_status: 'active',
        provider_subscription_id: { not: 'sub_new' },
      },
      select: { id: true, provider_subscription_id: true },
    })
    expect(db.donationSubscription.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['sub_row_1'] } },
      data: { provider_status: 'canceled' },
    })
    expect(stripeMock.cancelSubscription).toHaveBeenCalledWith('sub_prior')
    expect(canceled).toEqual(['sub_prior'])
  })
})
