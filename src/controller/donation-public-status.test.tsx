// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  GET_PLATFORM_CHURCH: vi.fn(),
  GET_DONATION_BY_PAYMENT_ID: vi.fn(),
  ENSURE_CHURCH_DONATION_ELIGIBLE: vi.fn(),
  stripe: {
    enabled: true,
    retrieveCheckoutSession: vi.fn(),
    createCheckoutSession: vi.fn(),
  },
}))

vi.mock('@/providers/donation', () => ({
  GET_DONATIONS: vi.fn(),
  GET_DONATION_SUBSCRIPTIONS: vi.fn(),
  GET_DONATION_SUMMARY: vi.fn(),
  GET_CHURCH_LABEL: vi.fn(),
  GET_MY_ACTIVE_GIFT: vi.fn(),
  GET_MY_ACTIVE_SUBSCRIPTION: vi.fn(),
  GET_MY_LATEST_DONATION: vi.fn(),
  GET_MY_PAID_DONATIONS: vi.fn(),
  GET_MY_DONATION_ATTEMPT: vi.fn(),
  GET_CHECKOUT_RECEIPT: vi.fn(),
  CANCEL_OTHER_CHURCH_SUBSCRIPTIONS: vi.fn(),
  ENSURE_CHURCH_DONATION_ELIGIBLE: m.ENSURE_CHURCH_DONATION_ELIGIBLE,
  GET_PLATFORM_CHURCH: m.GET_PLATFORM_CHURCH,
  GET_DONATION_BY_PAYMENT_ID: m.GET_DONATION_BY_PAYMENT_ID,
}))
vi.mock('@/providers/payment-sync', () => ({
  UPSERT_DONATION_PAYMENT: vi.fn(),
  UPSERT_DONATION_SUBSCRIPTION: vi.fn(),
}))
vi.mock('@/providers/stripe', () => ({
  STRIPE: m.stripe,
  isStripeEnabled: () => m.stripe.enabled,
}))

import { getPublicDonationStatus, initiatePublicDonation } from './donation'

const PLATFORM = { id: 'p1', name: 'Prayer 365' }
const paidAt = new Date('2026-11-12T09:15:00Z')

const session = (overrides: Record<string, unknown> = {}) => ({
  id: 'cs_1',
  mode: 'payment',
  status: 'complete',
  paymentStatus: 'paid',
  payment_intent: 'pi_1',
  metadata: { churchId: PLATFORM.id },
  ...overrides,
})

const ledgerRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'd1',
  status: 'PAID',
  amount_minor: BigInt(1000),
  currency: 'eur',
  paid_at: paidAt,
  ...overrides,
})

beforeEach(() => {
  vi.resetAllMocks()
  m.stripe.enabled = true
  m.GET_PLATFORM_CHURCH.mockResolvedValue(PLATFORM)
  m.ENSURE_CHURCH_DONATION_ELIGIBLE.mockResolvedValue({
    churchId: PLATFORM.id,
    churchName: PLATFORM.name,
  })
  m.GET_DONATION_BY_PAYMENT_ID.mockResolvedValue(null)
})

describe('getPublicDonationStatus', () => {
  it('confirms a paid session and reports the ledger amount', async () => {
    m.stripe.retrieveCheckoutSession.mockResolvedValue(session())
    m.GET_DONATION_BY_PAYMENT_ID.mockResolvedValue(ledgerRow())

    const res = await getPublicDonationStatus({ query: { sessionId: 'cs_1' } })

    expect(res).toEqual({
      state: 'confirmed',
      amountMinor: 1000,
      currency: 'EUR',
      paidAt,
    })
  })

  it('reports refunded from the ledger when the session already expired (webhook wins)', async () => {
    m.stripe.retrieveCheckoutSession.mockResolvedValue(
      session({ status: 'expired', paymentStatus: 'unpaid' }),
    )
    m.GET_DONATION_BY_PAYMENT_ID.mockResolvedValue(ledgerRow({ status: 'REFUNDED' }))

    await expect(getPublicDonationStatus({ query: { sessionId: 'cs_1' } })).resolves.toMatchObject({
      state: 'refunded',
      amountMinor: 1000,
    })
  })

  it('reports refunded even while the session still reads paid — Stripe never flips that back', async () => {
    m.stripe.retrieveCheckoutSession.mockResolvedValue(session())
    m.GET_DONATION_BY_PAYMENT_ID.mockResolvedValue(ledgerRow({ status: 'REFUNDED' }))

    await expect(getPublicDonationStatus({ query: { sessionId: 'cs_1' } })).resolves.toMatchObject({
      state: 'refunded',
      amountMinor: 1000,
      currency: 'EUR',
      paidAt,
    })
  })

  it('reports refunded for an expired unpaid session and keeps the ledger amount', async () => {
    m.stripe.retrieveCheckoutSession.mockResolvedValue(
      session({ status: 'expired', paymentStatus: 'unpaid' }),
    )
    m.GET_DONATION_BY_PAYMENT_ID.mockResolvedValue(
      ledgerRow({ status: 'REFUNDED', amount_minor: BigInt(2500) }),
    )

    await expect(getPublicDonationStatus({ query: { sessionId: 'cs_1' } })).resolves.toMatchObject({
      state: 'refunded',
      amountMinor: 2500,
    })
  })

  it('confirms a live session that reports paid even after a FAILED ledger row', async () => {
    m.stripe.retrieveCheckoutSession.mockResolvedValue(session())
    m.GET_DONATION_BY_PAYMENT_ID.mockResolvedValue(ledgerRow({ status: 'FAILED', paid_at: null }))

    const res = await getPublicDonationStatus({ query: { sessionId: 'cs_1' } })

    expect(res.state).toBe('confirmed')
    // No provider timestamp → no invented one.
    expect(res.paidAt).toBeNull()
  })

  it('reports pending while the session is open and unpaid', async () => {
    m.stripe.retrieveCheckoutSession.mockResolvedValue(
      session({ status: 'open', paymentStatus: 'unpaid', payment_intent: undefined }),
    )

    await expect(getPublicDonationStatus({ query: { sessionId: 'cs_1' } })).resolves.toEqual({
      state: 'pending',
      amountMinor: null,
      currency: null,
      paidAt: null,
    })
    // No payment intent yet → no ledger read at all.
    expect(m.GET_DONATION_BY_PAYMENT_ID).not.toHaveBeenCalled()
  })

  it('pends an expired-free session whose ledger row FAILED — the row is not final', async () => {
    m.stripe.retrieveCheckoutSession.mockResolvedValue(
      session({ status: 'complete', paymentStatus: 'unpaid' }),
    )
    m.GET_DONATION_BY_PAYMENT_ID.mockResolvedValue(ledgerRow({ status: 'FAILED', paid_at: null }))

    await expect(getPublicDonationStatus({ query: { sessionId: 'cs_1' } })).resolves.toMatchObject({
      state: 'pending',
    })
  })

  it('reports failed when the session expired and the ledger row FAILED', async () => {
    m.stripe.retrieveCheckoutSession.mockResolvedValue(
      session({ status: 'expired', paymentStatus: 'unpaid' }),
    )
    m.GET_DONATION_BY_PAYMENT_ID.mockResolvedValue(ledgerRow({ status: 'FAILED', paid_at: null }))

    await expect(getPublicDonationStatus({ query: { sessionId: 'cs_1' } })).resolves.toMatchObject({
      state: 'failed',
      paidAt: null,
    })
  })

  it('reports failed when the session expired with no ledger row', async () => {
    m.stripe.retrieveCheckoutSession.mockResolvedValue(
      session({ status: 'expired', paymentStatus: 'unpaid' }),
    )

    await expect(getPublicDonationStatus({ query: { sessionId: 'cs_1' } })).resolves.toMatchObject({
      state: 'failed',
    })
  })

  it('404s a session that belongs to a parish (cross-giver probing, D-14)', async () => {
    m.stripe.retrieveCheckoutSession.mockResolvedValue(
      session({ metadata: { churchId: 'parish-1' } }),
    )

    await expect(getPublicDonationStatus({ query: { sessionId: 'cs_1' } })).rejects.toMatchObject({
      code: 404,
      error_code: 'RESOURCE_NOT_FOUND',
    })
    expect(m.GET_DONATION_BY_PAYMENT_ID).not.toHaveBeenCalled()
  })

  it('404s an unknown / unreadable session', async () => {
    m.stripe.retrieveCheckoutSession.mockRejectedValue(new Error('No such checkout session'))

    await expect(getPublicDonationStatus({ query: { sessionId: 'cs_x' } })).rejects.toMatchObject({
      code: 404,
    })
  })

  it('404s a subscription-mode session (guests only ever start one-time gifts)', async () => {
    m.stripe.retrieveCheckoutSession.mockResolvedValue(session({ mode: 'subscription' }))

    await expect(getPublicDonationStatus({ query: { sessionId: 'cs_1' } })).rejects.toMatchObject({
      code: 404,
    })
  })

  it('503s while the platform row is missing (seed not run)', async () => {
    m.GET_PLATFORM_CHURCH.mockResolvedValue(null)

    await expect(getPublicDonationStatus({ query: { sessionId: 'cs_1' } })).rejects.toMatchObject({
      code: 503,
      error_code: 'DONATIONS_NOT_READY',
    })
  })

  it('503s instead of 404ing while the integration is disabled', async () => {
    m.stripe.enabled = false

    await expect(getPublicDonationStatus({ query: { sessionId: 'cs_1' } })).rejects.toMatchObject({
      code: 503,
      error_code: 'DONATIONS_NOT_READY',
    })
    expect(m.stripe.retrieveCheckoutSession).not.toHaveBeenCalled()
  })
})

describe('initiatePublicDonation', () => {
  const valid = { amountMinor: 1000, currency: 'eur', frequency: 'one_time' }

  it('starts a checkout for the platform beneficiary with server-built return URLs', async () => {
    m.stripe.createCheckoutSession.mockResolvedValue({ sessionId: 'cs_1', url: 'https://pay.test' })

    await expect(
      initiatePublicDonation({
        input: { ...valid, successUrl: 'https://evil.test/x', churchId: 'parish-1' },
      }),
    ).rejects.toMatchObject({ code: 422 })
    expect(m.stripe.createCheckoutSession).not.toHaveBeenCalled()

    const res = await initiatePublicDonation({ input: valid })

    expect(m.stripe.createCheckoutSession).toHaveBeenCalledWith({
      churchId: PLATFORM.id,
      churchName: PLATFORM.name,
      // A guest has no giver identity: this is what leaves `user_id` NULL.
      userId: undefined,
      amountMinor: 1000,
      currency: 'eur',
      frequency: 'one_time',
      category: undefined,
      customerId: undefined,
      successUrl: 'http://localhost:3000/donate/result?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'http://localhost:3000/give?canceled=1',
    })
    expect(res).toMatchObject({ sessionId: 'cs_1', url: 'https://pay.test' })
  })

  it('503s while the platform row is missing', async () => {
    m.GET_PLATFORM_CHURCH.mockResolvedValue(null)

    await expect(initiatePublicDonation({ input: valid })).rejects.toMatchObject({
      code: 503,
      error_code: 'DONATIONS_NOT_READY',
    })
    expect(m.stripe.createCheckoutSession).not.toHaveBeenCalled()
  })
})
