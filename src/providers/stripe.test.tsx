import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotImplementedError } from '@/utils/not-implemented-error'

const m = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
  subRetrieve: vi.fn(),
  subCancel: vi.fn(),
  subList: vi.fn(),
  portalCreate: vi.fn(),
  constructorArgs: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { create: m.create, retrieve: m.retrieve } }
    subscriptions = { retrieve: m.subRetrieve, cancel: m.subCancel, list: m.subList }
    billingPortal = { sessions: { create: m.portalCreate } }
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

  it('carries the ministry category into transaction metadata', async () => {
    m.create.mockResolvedValue({ id: 'cs_4', url: 'https://checkout.test/cs_4' })

    await STRIPE.createCheckoutSession({
      ...request,
      frequency: 'one_time',
      userId: 'u1',
      category: 'pantry',
    })

    const [params] = m.create.mock.calls[0]
    expect(params.metadata).toEqual({ churchId: 'c1', userId: 'u1', category: 'pantry' })
    // The giver's designation must reach the charge itself, not just the session.
    expect(params.payment_intent_data).toEqual({
      metadata: { churchId: 'c1', userId: 'u1', category: 'pantry' },
    })
  })

  it('fails loudly when Stripe returns no checkout url', async () => {
    m.create.mockResolvedValue({ id: 'cs_3', url: null })

    await expect(
      STRIPE.createCheckoutSession({ ...request, frequency: 'one_time' }),
    ).rejects.toMatchObject({ code: 502, error_code: 'STRIPE_SESSION_URL_MISSING' })
  })
})

describe('STRIPE.createBillingPortalSession', () => {
  it('opens the hosted portal for the customer with the in-app return url', async () => {
    m.portalCreate.mockResolvedValue({ url: 'https://billing.stripe.test/p_1' })

    const result = await STRIPE.createBillingPortalSession({
      customerId: 'cus_1',
      returnUrl: 'https://site.test/donate?church=st-john',
    })

    expect(m.portalCreate).toHaveBeenCalledWith({
      customer: 'cus_1',
      return_url: 'https://site.test/donate?church=st-john',
    })
    expect(result).toEqual({ url: 'https://billing.stripe.test/p_1' })
  })

  it('fails loudly when Stripe returns no portal url', async () => {
    m.portalCreate.mockResolvedValue({ url: null })

    await expect(
      STRIPE.createBillingPortalSession({ customerId: 'cus_1', returnUrl: 'https://site.test/x' }),
    ).rejects.toMatchObject({ code: 502, error_code: 'STRIPE_PORTAL_URL_MISSING' })
  })
})

describe('STRIPE.retrieveSubscription', () => {
  it('maps the customer id the billing portal needs', async () => {
    m.subRetrieve.mockResolvedValue({
      id: 'sub_1',
      status: 'active',
      customer: { id: 'cus_1' },
      items: { data: [{ price: { unit_amount: 1000, currency: 'eur' } }] },
      metadata: { churchId: 'c1' },
    })

    const sub = await STRIPE.retrieveSubscription('sub_1')

    expect(m.subRetrieve).toHaveBeenCalledWith('sub_1')
    expect(sub).toEqual({
      id: 'sub_1',
      status: 'active',
      customer: 'cus_1',
      canceledAt: null,
      cancelAt: null,
      cancelAtPeriodEnd: false,
      plan: { amount: 1000, currency: 'eur' },
      metadata: { churchId: 'c1' },
    })
  })

  it('keeps a string customer as-is', async () => {
    m.subRetrieve.mockResolvedValue({
      id: 'sub_2',
      status: 'past_due',
      customer: 'cus_2',
      items: { data: [] },
      metadata: {},
    })

    const sub = await STRIPE.retrieveSubscription('sub_2')

    expect(sub.customer).toBe('cus_2')
    expect(sub.plan).toBeUndefined()
  })

  it('maps cancellation timestamps and period-end flags', async () => {
    m.subRetrieve.mockResolvedValue({
      id: 'sub_3',
      status: 'active',
      customer: 'cus_3',
      canceled_at: 1792737150,
      cancel_at: 1795170189,
      cancel_at_period_end: false,
      items: { data: [] },
      metadata: {},
    })

    const sub = await STRIPE.retrieveSubscription('sub_3')

    expect(sub.canceledAt).toBe(1792737150)
    expect(sub.cancelAt).toBe(1795170189)
    expect(sub.cancelAtPeriodEnd).toBe(true)
  })
})

describe('STRIPE.cancelOtherChurchSubscriptions', () => {
  it('cancels active subscriptions matching the church except the current one', async () => {
    m.subList.mockResolvedValue({
      data: [
        { id: 'sub_new', metadata: { churchId: 'c1' } },
        { id: 'sub_prior', metadata: { churchId: 'c1' } },
        { id: 'sub_other_church', metadata: { churchId: 'other-church' } },
      ],
    })
    m.subCancel.mockResolvedValue({ id: 'sub_prior', status: 'canceled' })

    const canceled = await STRIPE.cancelOtherChurchSubscriptions({
      customerId: 'cus_1',
      churchId: 'c1',
      currentSubscriptionId: 'sub_new',
    })

    expect(m.subList).toHaveBeenCalledWith({
      customer: 'cus_1',
      status: 'active',
      limit: 20,
    })
    expect(m.subCancel).toHaveBeenCalledTimes(1)
    expect(m.subCancel).toHaveBeenCalledWith('sub_prior')
    expect(canceled).toEqual(['sub_prior'])
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
      status: null,
      paymentStatus: null,
      payment_intent: 'pi_1',
      subscription: 'sub_1',
      metadata: { churchId: 'c1' },
    })
    expect(m.retrieve).toHaveBeenCalledWith('cs_1', {}, undefined)
  })
})
