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
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (calls: Array<Promise<unknown>>) => Promise.all(calls)),
    donation: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    church: { findFirst: vi.fn() },
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
  GET_DONATIONS_ALL_CHURCHES,
  GET_DONATION_SUBSCRIPTIONS,
  GET_DONATION_SUMMARY,
  GET_DONATION_SUMMARY_BY_TYPE,
  GET_DONATION_SUMMARY_MONTHLY,
  GET_MY_ACTIVE_GIFT,
  CANCEL_OTHER_CHURCH_SUBSCRIPTIONS,
  GET_MY_LATEST_DONATION,
} from './donation'

const scope = new Set(['c1'])

beforeEach(() => vi.resetAllMocks())

describe('GET_DONATION_SUMMARY', () => {
  it('groups per currency and NEVER sums across currencies (net = gross - refunded per row)', async () => {
    vi.mocked(db.donation.groupBy).mockResolvedValue([
      {
        currency: 'USD',
        _sum: { amount_minor: BigInt(5000), refunded_minor: BigInt(1000) },
        _count: 2,
      },
      {
        currency: 'IDR',
        _sum: { amount_minor: BigInt(200000), refunded_minor: BigInt(0) },
        _count: 1,
      },
    ] as never)

    const res = await GET_DONATION_SUMMARY({ churchIds: scope, month: '2026-09' })
    expect(res.month).toBe('2026-09')
    // Two independent per-currency rows; no combined / cross-currency total exists.
    expect(res.currencies).toHaveLength(2)
    expect(res.currencies).toEqual([
      { currency: 'IDR', grossMinor: '200000', refundedMinor: '0', netMinor: '200000', count: 1 },
      { currency: 'USD', grossMinor: '5000', refundedMinor: '1000', netMinor: '4000', count: 2 },
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

  const row = (over: Record<string, unknown> = {}) => ({
    id: 'd1',
    amount_minor: BigInt(1000),
    currency: 'USD',
    status: 'PAID',
    paid_at: new Date('2026-09-05T00:00:00Z'),
    created_at: new Date('2026-09-05T00:00:00Z'),
    refunded_minor: BigInt(0),
    provider_payment_id: 'pi_1',
    church: { id: 'c1', name: 'St Mary' },
    user: null,
    ...over,
  })

  it('filters count AND rows by the church set and from/to bounds, deriving church, type and donor', async () => {
    vi.mocked(db.donation.count).mockResolvedValue(1)
    vi.mocked(db.donation.findMany).mockResolvedValue([row()] as never)

    const res = await GET_DONATIONS({
      churchIds: scope,
      query: {
        ...query,
        from: new Date('2026-09-01T00:00:00Z'),
        to: new Date('2026-09-30T00:00:00Z'),
      },
    })
    expect(res.total).toBe(1)
    // Admin DTO: church + derived type + refunded amount + donor (T-08). A guest
    // row has no `user`, so the donor cell must read null, never a blank object.
    expect(res.result[0]).toEqual({
      id: 'd1',
      amountMinor: '1000',
      currency: 'USD',
      status: 'PAID',
      paidAt: new Date('2026-09-05T00:00:00Z'),
      createdAt: new Date('2026-09-05T00:00:00Z'),
      ref: 'pi_1',
      churchId: 'c1',
      churchName: 'St Mary',
      type: 'CHURCH',
      refundedMinor: '0',
      donor: null,
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
    // Donor identity is selected only for the admin DTO; the mobile DTO stays `DonationRow`.
    expect(call.select).toMatchObject({
      church: { select: { id: true, name: true } },
      user: { select: { name: true, email: true } },
      refunded_minor: true,
    })
  })

  it('maps a registered donor to name + email', async () => {
    vi.mocked(db.donation.count).mockResolvedValue(1)
    vi.mocked(db.donation.findMany).mockResolvedValue([
      row({ user: { name: 'Mari', email: 'mari@example.com' } }),
    ] as never)

    const res = await GET_DONATIONS({ churchIds: scope, query })

    expect(res.result[0]!.donor).toEqual({ name: 'Mari', email: 'mari@example.com' })
  })

  it('includes failed donations with null paid_at by falling back to created_at in date bounds', async () => {
    vi.mocked(db.donation.count).mockResolvedValue(1)
    vi.mocked(db.donation.findMany).mockResolvedValue([
      row({
        id: 'd-failed',
        amount_minor: BigInt(2500),
        status: 'FAILED',
        paid_at: null,
        created_at: new Date('2026-09-10T12:00:00Z'),
        provider_payment_id: 'pi_fail_1',
      }),
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
    expect(res.result[0]).toMatchObject({
      id: 'd-failed',
      amountMinor: '2500',
      status: 'FAILED',
      paidAt: null,
      createdAt: new Date('2026-09-10T12:00:00Z'),
      ref: 'pi_fail_1',
    })
  })

  it('filters by normalized currency when requested', async () => {
    vi.mocked(db.donation.count).mockResolvedValue(1)
    vi.mocked(db.donation.findMany).mockResolvedValue([row({ currency: 'usd' })] as never)

    await GET_DONATIONS({
      churchIds: scope,
      query: { ...query, currency: 'USD' },
    })

    const call = vi.mocked(db.donation.findMany).mock.calls[0]![0]!
    const where = call.where as { currency?: string }
    expect(where.currency).toBe('usd')
  })

  it('passes the ledger status straight into the where clause', async () => {
    vi.mocked(db.donation.count).mockResolvedValue(0)
    vi.mocked(db.donation.findMany).mockResolvedValue([] as never)

    await GET_DONATIONS({
      churchIds: scope,
      query: { ...query, status: 'REFUNDED' },
    })

    const call = vi.mocked(db.donation.findMany).mock.calls[0]![0]!
    const where = call.where as { church_id: { in: string[] }; status?: string }
    expect(where.church_id.in).toEqual(['c1'])
    expect(where.status).toBe('REFUNDED')
    // The count must apply the same filter, or the pagination total would lie.
    expect(vi.mocked(db.donation.count).mock.calls[0]![0]!.where).toBe(call.where)
  })

  it('returns empty without querying when the scope resolves no churches', async () => {
    const res = await GET_DONATIONS({ churchIds: new Set(), query })
    expect(res).toEqual({ result: [], total: 0 })
    expect(db.donation.count).not.toHaveBeenCalled()
  })
})

describe('GET_DONATIONS_ALL_CHURCHES', () => {
  const query = {
    page: 1,
    limit: 25,
    order_by: 'paid_at' as const,
    order_direction: 'desc' as const,
  }

  it('unions the platform church even when the scope walk never returned it (T-03)', async () => {
    vi.mocked(db.donation.count).mockResolvedValue(2)
    vi.mocked(db.donation.findMany).mockResolvedValue([
      {
        id: 'd-church',
        amount_minor: BigInt(1000),
        currency: 'EUR',
        status: 'PAID',
        paid_at: new Date('2026-11-02T00:00:00Z'),
        created_at: new Date('2026-11-02T00:00:00Z'),
        refunded_minor: BigInt(0),
        provider_payment_id: 'pi_church',
        church: { id: 'c1', name: 'St Mary' },
        user: null,
      },
      {
        id: 'd-prayer',
        amount_minor: BigInt(500),
        currency: 'EUR',
        status: 'PAID',
        paid_at: new Date('2026-11-03T00:00:00Z'),
        created_at: new Date('2026-11-03T00:00:00Z'),
        refunded_minor: BigInt(0),
        provider_payment_id: 'pi_prayer',
        church: { id: 'p1', name: 'Prayer 365' },
        user: null,
      },
    ] as never)

    const res = await GET_DONATIONS_ALL_CHURCHES({
      churchIds: new Set(['c1']),
      platformChurchId: 'p1',
      query,
    })

    expect(res.total).toBe(2)
    expect(vi.mocked(db.donation.findMany).mock.calls[0]![0]!.where).toMatchObject({
      church_id: { in: ['c1', 'p1'] },
    })
    expect(res.result.map((r) => [r.churchName, r.type])).toEqual([
      ['St Mary', 'CHURCH'],
      ['Prayer 365', 'PRAYER'],
    ])
  })

  it('still queries the platform ledger when the scope resolves no churches', async () => {
    vi.mocked(db.donation.count).mockResolvedValue(0)
    vi.mocked(db.donation.findMany).mockResolvedValue([] as never)

    await GET_DONATIONS_ALL_CHURCHES({
      churchIds: new Set(),
      platformChurchId: 'p1',
      query,
    })

    expect(vi.mocked(db.donation.findMany).mock.calls[0]![0]!.where).toMatchObject({
      church_id: { in: ['p1'] },
    })
  })
})

describe('GET_DONATION_SUMMARY_BY_TYPE', () => {
  it('buckets one grouped query into total / church / prayer per currency', async () => {
    vi.mocked(db.donation.groupBy).mockResolvedValue([
      {
        church_id: 'c1',
        currency: 'EUR',
        _sum: { amount_minor: BigInt(10000), refunded_minor: BigInt(1000) },
        _count: 2,
      },
      {
        church_id: 'p1',
        currency: 'EUR',
        _sum: { amount_minor: BigInt(500), refunded_minor: BigInt(0) },
        _count: 1,
      },
      {
        church_id: 'c1',
        currency: 'USD',
        _sum: { amount_minor: BigInt(2500), refunded_minor: BigInt(0) },
        _count: 1,
      },
    ] as never)

    const from = new Date('2026-11-01T00:00:00Z')
    const to = new Date('2026-11-30T23:59:59.999Z')
    const res = await GET_DONATION_SUMMARY_BY_TYPE({
      churchIds: new Set(['c1']),
      platformChurchId: 'p1',
      from,
      to,
    })

    expect(res.currencies).toEqual([
      {
        currency: 'EUR',
        total: { grossMinor: '10500', refundedMinor: '1000', netMinor: '9500', count: 3 },
        church: { grossMinor: '10000', refundedMinor: '1000', netMinor: '9000', count: 2 },
        prayer: { grossMinor: '500', refundedMinor: '0', netMinor: '500', count: 1 },
      },
      {
        currency: 'USD',
        total: { grossMinor: '2500', refundedMinor: '0', netMinor: '2500', count: 1 },
        church: { grossMinor: '2500', refundedMinor: '0', netMinor: '2500', count: 1 },
        prayer: { grossMinor: '0', refundedMinor: '0', netMinor: '0', count: 0 },
      },
    ])

    const call = vi.mocked(db.donation.groupBy).mock.calls[0]![0]!
    expect(call.by).toEqual(['church_id', 'currency'])
    expect(call.where).toMatchObject({
      church_id: { in: ['c1', 'p1'] },
      paid_at: { gte: from, lte: to },
    })
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
        church: { id: 'c1', name: 'Hope Church' },
      },
    ] as never)
    vi.mocked(db.donation.findMany).mockResolvedValue([
      { subscription_id: 's1', invoice_url: 'https://pay.stripe.test/receipt/sub1' },
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
      churchId: 'c1',
      churchName: 'Hope Church',
      frequency: 'Monthly',
      invoiceUrl: 'https://pay.stripe.test/receipt/sub1',
    })
    const call = vi.mocked(db.donationSubscription.findMany).mock.calls[0]![0]!
    const where = call.where as { church_id: { in: string[] } }
    expect(where.church_id.in).toEqual(['c1'])
  })
  it('filters subscriptions by normalized currency when requested', async () => {
    vi.mocked(db.donationSubscription.count).mockResolvedValue(1)
    vi.mocked(db.donationSubscription.findMany).mockResolvedValue([] as never)
    vi.mocked(db.donation.findMany).mockResolvedValue([] as never)

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

describe('GET_MY_LATEST_DONATION', () => {
  it('returns the latest paid donation across all churches', async () => {
    vi.mocked(db.donation.findFirst).mockResolvedValue({
      id: 'd1',
      amount_minor: BigInt(5000),
      currency: 'eur',
      paid_at: new Date('2026-10-23T07:50:00.000Z'),
      subscription_id: 'sub_1',
      church: { id: 'c1', name: 'St. John', slug: 'st-john' },
    } as never)

    const res = await GET_MY_LATEST_DONATION({ userId: 'u1' })

    expect(db.donation.findFirst).toHaveBeenCalledWith({
      where: { user_id: 'u1', status: 'PAID' },
      orderBy: [{ paid_at: 'desc' }, { created_at: 'desc' }, { id: 'desc' }],
      include: { church: { select: { id: true, name: true, slug: true } } },
    })
    expect(res).toEqual({
      id: 'd1',
      amountMinor: 5000,
      currency: 'EUR',
      paidAt: new Date('2026-10-23T07:50:00.000Z'),
      isMonthly: true,
      churchId: 'c1',
      churchName: 'St. John',
      churchSlug: 'st-john',
    })
  })

  it('returns null when user has no paid donations', async () => {
    vi.mocked(db.donation.findFirst).mockResolvedValue(null)
    expect(await GET_MY_LATEST_DONATION({ userId: 'u1' })).toBeNull()
  })
})

describe('GET_PLATFORM_CHURCH (PD-DB-04)', () => {
  it('resolves the platform beneficiary by slug, APPROVED and flagged', async () => {
    vi.mocked(db.church.findFirst).mockResolvedValue({ id: 'p1', name: 'Prayer 365' } as never)

    const { GET_PLATFORM_CHURCH } = await import('./donation')
    expect(await GET_PLATFORM_CHURCH()).toEqual({ id: 'p1', name: 'Prayer 365' })
    expect(db.church.findFirst).toHaveBeenCalledWith({
      where: { slug: 'prayer365', status: 'APPROVED', is_platform: true },
      select: { id: true, name: true },
    })
  })
})

describe('GET_DONATION_BY_PAYMENT_ID (PD-DB-04)', () => {
  it('looks the ledger row up by the unique provider payment id, owner id only', async () => {
    vi.mocked(db.donation.findUnique).mockResolvedValue({
      id: 'd1',
      // The owner id lets a caller bind the row to a signed-in giver; no name,
      // email or other donor profile data is read.
      user_id: 'u1',
      status: 'PAID',
      amount_minor: BigInt(1000),
      currency: 'eur',
      paid_at: new Date('2026-11-12T10:00:00.000Z'),
    } as never)

    const { GET_DONATION_BY_PAYMENT_ID } = await import('./donation')
    const res = await GET_DONATION_BY_PAYMENT_ID({ providerPaymentId: 'pi_123' })

    expect(db.donation.findUnique).toHaveBeenCalledWith({
      where: { provider_payment_id: 'pi_123' },
      select: {
        id: true,
        user_id: true,
        status: true,
        amount_minor: true,
        currency: true,
        paid_at: true,
      },
    })
    expect(res?.status).toBe('PAID')
  })
})

describe('GET_DONATION_SUMMARY_MONTHLY', () => {
  it('runs ONE grouped query bound to the church set and the range, then maps per currency', async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([
      { month: '2026-11', currency: 'EUR', gross_minor: '1500', refunded_minor: '500', count: 2 },
      { month: '2026-10', currency: 'EUR', gross_minor: '900', refunded_minor: '0', count: 1 },
    ] as never)
    const from = new Date('2026-01-01T00:00:00Z')
    const to = new Date('2026-11-30T23:59:59Z')

    const res = await GET_DONATION_SUMMARY_MONTHLY({ churchIds: new Set(['c1']), from, to })

    expect(res).toEqual([
      {
        month: '2026-11',
        currency: 'eur',
        grossMinor: '1500',
        refundedMinor: '500',
        netMinor: '1000',
        count: 2,
      },
      {
        month: '2026-10',
        currency: 'eur',
        grossMinor: '900',
        refundedMinor: '0',
        netMinor: '900',
        count: 1,
      },
    ])
    const call = vi.mocked(db.$queryRaw).mock.calls[0]!
    expect(call[1]).toEqual(['c1'])
    expect(call[2]).toEqual(from)
    expect(call[3]).toEqual(to)
    expect(String(call[0])).toContain('GROUP BY')
  })

  it('skips the query for an empty church set', async () => {
    const res = await GET_DONATION_SUMMARY_MONTHLY({ churchIds: new Set<string>() })

    expect(res).toEqual([])
    expect(db.$queryRaw).not.toHaveBeenCalled()
  })
})
