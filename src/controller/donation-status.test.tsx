import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  GET_CHURCH_LABEL: vi.fn(),
  GET_MY_DONATION_ATTEMPT: vi.fn(),
  GET_CHECKOUT_RECEIPT: vi.fn(),
  GET_MY_ACTIVE_GIFT: vi.fn(),
  GET_MY_PAID_DONATIONS: vi.fn(),
}))

vi.mock('@/providers/donation', () => ({
  GET_DONATIONS: vi.fn(),
  GET_DONATION_SUBSCRIPTIONS: vi.fn(),
  GET_DONATION_SUMMARY: vi.fn(),
  ENSURE_CHURCH_DONATION_ELIGIBLE: vi.fn(),
  GET_MY_ACTIVE_GIFT: m.GET_MY_ACTIVE_GIFT,
  GET_CHURCH_LABEL: m.GET_CHURCH_LABEL,
  GET_MY_PAID_DONATIONS: m.GET_MY_PAID_DONATIONS,
  GET_MY_DONATION_ATTEMPT: m.GET_MY_DONATION_ATTEMPT,
  GET_CHECKOUT_RECEIPT: m.GET_CHECKOUT_RECEIPT,
}))
vi.mock('@/providers/stripe', () => ({ STRIPE: {} }))

import { getDonationStatus, getMyDonationOverview } from './donation'

const query = {
  sessionId: 'cs_1',
  churchId: 'c1',
  amountMinor: 1000,
  currency: 'eur',
  frequency: 'monthly' as const,
}

const paidAt = new Date('2026-10-20T09:15:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  m.GET_CHURCH_LABEL.mockResolvedValue({ id: 'c1', name: 'St. John' })
  m.GET_CHECKOUT_RECEIPT.mockResolvedValue(null)
  m.GET_MY_DONATION_ATTEMPT.mockResolvedValue(null)
})

describe('getDonationStatus — outcome comes from our records, never the URL', () => {
  it('confirms only on a PAID row and echoes the attempt shape', async () => {
    m.GET_MY_DONATION_ATTEMPT.mockResolvedValue({ status: 'PAID', paidAt })

    const status = await getDonationStatus({ userId: 'u1', query })

    expect(status).toMatchObject({
      state: 'confirmed',
      paidAt,
      churchName: 'St. John',
      amountMinor: 1000,
      currency: 'EUR',
      frequency: 'monthly',
    })
    expect(m.GET_MY_DONATION_ATTEMPT).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        churchId: 'c1',
        amountMinor: 1000,
        currency: 'eur',
        frequency: 'monthly',
      }),
    )
  })

  it('treats a REFUNDED gift as a gift that was paid', async () => {
    m.GET_MY_DONATION_ATTEMPT.mockResolvedValue({ status: 'REFUNDED', paidAt })

    expect((await getDonationStatus({ userId: 'u1', query })).state).toBe('confirmed')
  })

  it('reports failed only for a FAILED row', async () => {
    m.GET_MY_DONATION_ATTEMPT.mockResolvedValue({ status: 'FAILED', paidAt: null })

    const status = await getDonationStatus({ userId: 'u1', query })

    expect(status.state).toBe('failed')
    expect(status.paidAt).toBeNull()
  })

  it('stays pending when Stripe reported the session but no row has landed', async () => {
    m.GET_CHECKOUT_RECEIPT.mockResolvedValue({
      event_type: 'checkout.session.completed',
      state: 'PROCESSED',
      received_at: new Date(),
    })

    const status = await getDonationStatus({ userId: 'u1', query })

    expect(status.state).toBe('pending')
    expect(status.receiptSeen).toBe(true)
  })

  it('never invents a failure or a success when nothing is recorded', async () => {
    const status = await getDonationStatus({ userId: 'u1', query })

    expect(status.state).toBe('pending')
    expect(status.receiptSeen).toBe(false)
    expect(status.paidAt).toBeNull()
  })

  it('hides an unknown church with 404', async () => {
    m.GET_CHURCH_LABEL.mockResolvedValue(null)

    await expect(getDonationStatus({ userId: 'u1', query })).rejects.toMatchObject({
      code: 404,
      error_code: 'CHURCH_NOT_FOUND',
    })
  })
})

describe('getMyDonationOverview — the giver sees only their own giving', () => {
  it('groups per currency and never sums across them', async () => {
    m.GET_MY_ACTIVE_GIFT.mockResolvedValue(null)
    m.GET_MY_PAID_DONATIONS.mockResolvedValue([
      { currency: 'EUR', amountMinor: 2500, paidAt: new Date('2026-03-04T10:00:00Z') },
      { currency: 'EUR', amountMinor: 2500, paidAt: new Date('2026-03-28T10:00:00Z') },
      { currency: 'SEK', amountMinor: 10000, paidAt: new Date('2026-05-01T10:00:00Z') },
    ])

    const overview = await getMyDonationOverview({ userId: 'u1' })

    expect(overview.contributions).toEqual([
      { currency: 'EUR', totalMinor: 5000, count: 2, months: [2] },
      { currency: 'SEK', totalMinor: 10000, count: 1, months: [4] },
    ])
    // No pledge → no derived next charge, whatever the gifts say.
    expect(overview.nextGiftAt).toBeNull()
  })

  it('derives the next charge from the latest gift to the pledged parish', async () => {
    m.GET_MY_ACTIVE_GIFT.mockResolvedValue({
      amountMinor: 1000,
      currency: 'EUR',
      churchId: 'c1',
      churchName: 'St. John',
    })
    m.GET_MY_PAID_DONATIONS.mockResolvedValue([
      {
        currency: 'EUR',
        amountMinor: 1000,
        paidAt: new Date('2026-01-31T08:00:00Z'),
        churchId: 'c1',
      },
      {
        currency: 'EUR',
        amountMinor: 1000,
        paidAt: new Date('2025-12-31T08:00:00Z'),
        churchId: 'c1',
      },
      {
        currency: 'EUR',
        amountMinor: 500,
        paidAt: new Date('2026-02-10T08:00:00Z'),
        churchId: 'c2',
      },
    ])

    const overview = await getMyDonationOverview({ userId: 'u1' })

    expect(overview.year).toBe(new Date().getUTCFullYear())
    // Jan 31 has no February twin: the estimate clamps to the shorter month.
    expect(overview.nextGiftAt?.toISOString()).toBe('2026-02-28T08:00:00.000Z')
  })
})
