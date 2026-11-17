// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  GET_PLATFORM_CHURCH: vi.fn(),
  GET_DONATIONS: vi.fn(),
  GET_DONATION_SUMMARY: vi.fn(),
}))

vi.mock('@/providers/donation', () => ({
  GET_PLATFORM_CHURCH: m.GET_PLATFORM_CHURCH,
  GET_DONATIONS: m.GET_DONATIONS,
  GET_DONATION_SUMMARY: m.GET_DONATION_SUMMARY,
  GET_DONATION_SUBSCRIPTIONS: vi.fn(),
  GET_CHURCH_LABEL: vi.fn(),
  GET_MY_ACTIVE_GIFT: vi.fn(),
  GET_MY_ACTIVE_SUBSCRIPTION: vi.fn(),
  GET_MY_LATEST_DONATION: vi.fn(),
  GET_MY_PAID_DONATIONS: vi.fn(),
  GET_MY_DONATION_ATTEMPT: vi.fn(),
  GET_CHECKOUT_RECEIPT: vi.fn(),
  CANCEL_OTHER_CHURCH_SUBSCRIPTIONS: vi.fn(),
  ENSURE_CHURCH_DONATION_ELIGIBLE: vi.fn(),
  GET_DONATION_BY_PAYMENT_ID: vi.fn(),
}))
vi.mock('@/providers/payment-sync', () => ({
  UPSERT_DONATION_PAYMENT: vi.fn(),
  UPSERT_DONATION_SUBSCRIPTION: vi.fn(),
}))
vi.mock('@/providers/stripe', () => ({ STRIPE: {}, isStripeEnabled: () => true }))

import { getPlatformDonationSummary, listPlatformDonations } from './donation'

const PLATFORM = { id: 'p1', name: 'Prayer 365' }

beforeEach(() => {
  vi.resetAllMocks()
  m.GET_PLATFORM_CHURCH.mockResolvedValue(PLATFORM)
  m.GET_DONATIONS.mockResolvedValue({ result: [], total: 0 })
  m.GET_DONATION_SUMMARY.mockResolvedValue({ month: '2026-11', currencies: [] })
})

describe('platform giving readers', () => {
  it('reads the guest ledger and never a parish ledger', async () => {
    await listPlatformDonations({
      query: { page: 1, limit: 25, order_by: 'paid_at', order_direction: 'desc' },
    })

    expect(m.GET_DONATIONS).toHaveBeenCalledWith({
      churchIds: new Set([PLATFORM.id]),
      query: expect.objectContaining({ page: 1, limit: 25 }),
    })
  })

  it('scopes the monthly summary to the platform row alone', async () => {
    await getPlatformDonationSummary({ month: '2026-11' })

    expect(m.GET_DONATION_SUMMARY).toHaveBeenCalledWith({
      churchIds: new Set([PLATFORM.id]),
      month: '2026-11',
    })
  })

  it('503s rather than reporting an empty ledger when the platform row is missing', async () => {
    m.GET_PLATFORM_CHURCH.mockResolvedValue(null)

    await expect(
      listPlatformDonations({
        query: { page: 1, limit: 25, order_by: 'paid_at', order_direction: 'desc' },
      }),
    ).rejects.toMatchObject({ code: 503, error_code: 'DONATIONS_NOT_READY' })
    expect(m.GET_DONATIONS).not.toHaveBeenCalled()
  })
})
