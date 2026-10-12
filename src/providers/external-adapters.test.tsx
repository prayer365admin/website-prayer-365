// @vitest-environment node
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { STRIPE } from './stripe'
import { NotImplementedError } from '@/utils/not-implemented-error'

/*
 * Phase 10 external-service adapter stubs must THROW a NotImplementedError and
 * never silently return a success-looking value (SPEC 9.6 / 9.3.1, plan 45).
 */
describe('external provider adapters are idle pending stubs', () => {
  const originalStripeEnabled = process.env.STRIPE_ENABLED
  beforeEach(() => {
    delete process.env.STRIPE_ENABLED
  })
  afterEach(() => {
    process.env.STRIPE_ENABLED = originalStripeEnabled
  })
  it.each([
    ['STRIPE.createCheckoutSession', () => STRIPE.createCheckoutSession({} as never)],
    ['STRIPE.constructWebhookEvent', () => STRIPE.constructWebhookEvent('{raw}', 'sig')],
    ['STRIPE.retrievePaymentIntent', () => STRIPE.retrievePaymentIntent('pi_123')],
    ['STRIPE.retrieveSubscription', () => STRIPE.retrieveSubscription('sub_123')],
    ['STRIPE.retrieveCharge', () => STRIPE.retrieveCharge('ch_123')],
    ['STRIPE.retrieveCheckoutSession', () => STRIPE.retrieveCheckoutSession('cs_123')],
  ])('%s throws NotImplementedError, never silently succeeds', async (_name, call) => {
    const err = await call().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(NotImplementedError)
    expect((err as Error).message).toMatch(/external integration pending/)
  })

  it('errors carry the NotImplementedError name', async () => {
    const err = await STRIPE.createCheckoutSession({} as never).catch((e: unknown) => e)
    expect((err as Error).name).toBe('NotImplementedError')
  })
})
