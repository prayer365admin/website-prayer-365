import { NotImplementedError } from '@/utils/not-implemented-error'

/*
 * Stripe external-service adapter stub (SPEC 9.6 / plan Task 45).
 *
 * This is the SEAM the Phase 10 payment/checkout controller calls and the
 * Stripe webhook deliverable fills. Until then every method THROWS a
 * NotImplementedError and never returns a value that looks like success. The
 * raw-body webhook handler, signature verification and durable receipts are
 * a separate Phase 10 deliverable and do NOT live here.
 */

const PENDING_MESSAGE = 'external integration pending — see Phase 10 worker/webhook deliverable'

const ensureEnabled = (method: string): void => {
  if (process.env.STRIPE_ENABLED !== 'true') {
    throw new NotImplementedError(`STRIPE.${method}: ${PENDING_MESSAGE}`)
  }
}

const pending = (method: string): never => {
  throw new NotImplementedError(`STRIPE.${method}: ${PENDING_MESSAGE}`)
}

/** Feature flag: true only when the Phase 10 integration is enabled. */
export const isStripeEnabled = () => process.env.STRIPE_ENABLED === 'true'

export interface CheckoutSessionRequest {
  churchId: string
  paymentAccountId: string
  amountMinor: number
  currency: string
  successUrl: string
  cancelUrl: string
}
export interface CheckoutSessionResult {
  sessionId: string
  url: string
}
export interface ParsedWebhookEvent {
  id: string
  type: string
  objectId: string
}

export const STRIPE = {
  /** Create a Stripe Checkout/payment session for a church donation. */
  async createCheckoutSession(_req: CheckoutSessionRequest): Promise<CheckoutSessionResult> {
    ensureEnabled('createCheckoutSession')
    return pending('createCheckoutSession')
  },
  /** Verify a raw webhook signature and parse the typed event. */
  async constructWebhookEvent(_rawBody: string, _signature: string): Promise<ParsedWebhookEvent> {
    ensureEnabled('constructWebhookEvent')
    return pending('constructWebhookEvent')
  },
}
