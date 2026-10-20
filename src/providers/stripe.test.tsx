import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotImplementedError } from '@/utils/not-implemented-error'

const m = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
  constructorArgs: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { create: m.create, retrieve: m.retrieve } }
    constructor(...args: unknown[]) {
      m.constructorArgs(...args)
    }
  },
}))

import { STRIPE, isStripeEnabled } from './stripe'

const request = {
  churchId: 'c1',
  amountMinor: 1234,
  currency: 'eur',
  successUrl: 'https://site.test/donate/result?session_id=cs_1',
  cancelUrl: 'https://site.test/donate/c1',
}

const env = { ...process.env }

beforeEach(() => {
  vi.resetAllMocks()
  process.env.STRIPE_ENABLED = 'true'
  process.env.STRIPE_SECRET_KEY = 'sk_test_1'
})

afterEach(() => {
  process.env = { ...env }
})

describe('STRIPE.createCheckoutSession', () => {
  it('still refuses to pretend the integration works when the flag is off', async () => {
    process.env.STRIPE_ENABLED = 'false'
    expect(isStripeEnabled()).toBe(false)

    await expect(
      STRIPE.createCheckoutSession({ ...request, frequency: 'one_time' }),
    ).rejects.toBeInstanceOf(NotImplementedError)
    expect(m.create).not.toHaveBeenCalled()
  })

  it('builds a monthly subscription session carrying church + giver metadata', async () => {
    m.create.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.test/cs_1' })

    const result = await STRIPE.createCheckoutSession({
      ...request,
      frequency: 'monthly',
      churchName: "St. John's",
      userId: 'u1',
    })

    expect(result).toEqual({ sessionId: 'cs_1', url: 'https://checkout.test/cs_1' })
    const [params] = m.create.mock.calls[0]
    expect(params.mode).toBe('subscription')
    expect(params.line_items[0].price_data).toMatchObject({
      currency: 'eur',
      unit_amount: 1234,
      product_data: { name: "St. John's offering" },
      recurring: { interval: 'month' },
    })
    expect(params.subscription_data).toEqual({ metadata: { churchId: 'c1', userId: 'u1' } })
    // Stripe rejects payment_intent_data in subscription mode.
    expect(params.payment_intent_data).toBeUndefined()
    expect(params.success_url).toBe(request.successUrl)
    expect(params.cancel_url).toBe(request.cancelUrl)
  })

  it('builds a one-time payment session without a recurring price', async () => {
    m.create.mockResolvedValue({ id: 'cs_2', url: 'https://checkout.test/cs_2' })

    await STRIPE.createCheckoutSession({ ...request, frequency: 'one_time' })

    const [params] = m.create.mock.calls[0]
    expect(params.mode).toBe('payment')
    expect(params.line_items[0].price_data.recurring).toBeUndefined()
    expect(params.line_items[0].price_data.product_data.name).toBe('Prayer 365 offering')
    expect(params.payment_intent_data).toEqual({ metadata: { churchId: 'c1' } })
    expect(params.subscription_data).toBeUndefined()
  })

  it('fails loudly when Stripe returns no checkout url', async () => {
    m.create.mockResolvedValue({ id: 'cs_3', url: null })

    await expect(
      STRIPE.createCheckoutSession({ ...request, frequency: 'one_time' }),
    ).rejects.toMatchObject({ code: 502, error_code: 'STRIPE_SESSION_URL_MISSING' })
  })
})

describe('STRIPE.retrieveCheckoutSession', () => {
  it('maps the SDK session, collapsing expanded ids to strings', async () => {
    m.retrieve.mockResolvedValue({
      id: 'cs_1',
      mode: 'payment',
      payment_intent: { id: 'pi_1' },
      subscription: 'sub_1',
      metadata: { churchId: 'c1' },
    })

    const session = await STRIPE.retrieveCheckoutSession('cs_1')

    expect(session).toEqual({
      id: 'cs_1',
      mode: 'payment',
      payment_intent: 'pi_1',
      subscription: 'sub_1',
      metadata: { churchId: 'c1' },
    })
    expect(m.retrieve).toHaveBeenCalledWith('cs_1', {}, undefined)
  })
})
