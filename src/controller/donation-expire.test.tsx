import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  retrieveCheckoutSession: vi.fn(),
  expireCheckoutSession: vi.fn(),
}))

vi.mock('@/providers/donation', () => ({}))
vi.mock('@/providers/payment-sync', () => ({}))
vi.mock('@/providers/stripe', () => ({
  STRIPE: {
    retrieveCheckoutSession: m.retrieveCheckoutSession,
    expireCheckoutSession: m.expireCheckoutSession,
  },
  isStripeEnabled: () => true,
}))

import { expireDonationAttempt } from './donation'

const open = (over = {}) => ({
  id: 'cs_1',
  mode: 'payment',
  status: 'open',
  paymentStatus: 'unpaid',
  metadata: { userId: 'u1', churchId: 'c1' },
  ...over,
})

describe('expireDonationAttempt', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('expires the caller’s open session', async () => {
    m.retrieveCheckoutSession.mockResolvedValue(open())
    await expect(expireDonationAttempt({ userId: 'u1', sessionId: 'cs_1' })).resolves.toEqual({
      state: 'expired',
    })
    expect(m.expireCheckoutSession).toHaveBeenCalledWith('cs_1')
  })

  it('hides another giver’s session behind a 404', async () => {
    m.retrieveCheckoutSession.mockResolvedValue(open({ metadata: { userId: 'someone-else' } }))
    await expect(expireDonationAttempt({ userId: 'u1', sessionId: 'cs_1' })).rejects.toMatchObject({
      code: 404,
      error_code: 'DONATION_ATTEMPT_NOT_FOUND',
    })
    expect(m.expireCheckoutSession).not.toHaveBeenCalled()
  })

  it('404s an unknown session', async () => {
    m.retrieveCheckoutSession.mockRejectedValue(new Error('No such session'))
    await expect(expireDonationAttempt({ userId: 'u1', sessionId: 'nope' })).rejects.toMatchObject({
      code: 404,
    })
  })

  it('never expires a session that already completed or was paid', async () => {
    m.retrieveCheckoutSession.mockResolvedValue(open({ status: 'complete', paymentStatus: 'paid' }))
    await expect(expireDonationAttempt({ userId: 'u1', sessionId: 'cs_1' })).resolves.toEqual({
      state: 'completed',
    })
    m.retrieveCheckoutSession.mockResolvedValue(
      open({ status: 'complete', paymentStatus: 'unpaid' }),
    )
    await expect(expireDonationAttempt({ userId: 'u1', sessionId: 'cs_1' })).resolves.toEqual({
      state: 'completed',
    })
    expect(m.expireCheckoutSession).not.toHaveBeenCalled()
  })

  it('is idempotent for an already expired session', async () => {
    m.retrieveCheckoutSession.mockResolvedValue(open({ status: 'expired' }))
    await expect(expireDonationAttempt({ userId: 'u1', sessionId: 'cs_1' })).resolves.toEqual({
      state: 'expired',
    })
    expect(m.expireCheckoutSession).not.toHaveBeenCalled()
  })

  it('reports completed when the giver pays between our read and the expire call', async () => {
    m.retrieveCheckoutSession
      .mockResolvedValueOnce(open())
      .mockResolvedValueOnce(open({ status: 'complete', paymentStatus: 'paid' }))
    m.expireCheckoutSession.mockRejectedValue(new Error('session is complete'))
    await expect(expireDonationAttempt({ userId: 'u1', sessionId: 'cs_1' })).resolves.toEqual({
      state: 'completed',
    })
  })

  it('surfaces a real Stripe failure', async () => {
    m.retrieveCheckoutSession.mockResolvedValue(open())
    m.expireCheckoutSession.mockRejectedValue(new Error('stripe down'))
    await expect(expireDonationAttempt({ userId: 'u1', sessionId: 'cs_1' })).rejects.toThrow(
      'stripe down',
    )
  })
})
