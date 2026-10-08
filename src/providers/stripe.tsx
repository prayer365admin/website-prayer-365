import { NotImplementedError } from '@/utils/not-implemented-error'
import { GeneralError } from '@/utils/general-error'
import { verifyStripeWebhookSignature, parseStripeWebhookEvent } from './stripe-webhook'

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

export interface StripePaymentIntent {
  id: string
  amount: number
  currency: string
  status: string
  invoice?: string
  metadata?: Record<string, string>
}

export interface StripeSubscription {
  id: string
  status: string
  plan?: {
    amount: number
    currency: string
  }
  metadata?: Record<string, string>
}

export interface StripeCharge {
  id: string
  amount: number
  amount_refunded: number
  currency: string
  status: string
  payment_intent?: string | { id: string }
}

export interface StripeCheckoutSession {
  id: string
  mode: string
  payment_intent?: string
  subscription?: string
  metadata?: Record<string, string>
}

export interface StripeInvoice {
  id: string
  payment_intent?: string | { id: string }
  subscription?: string
  amount_paid: number
  total: number
  currency: string
}

export const STRIPE = {
  /** Retrieve a Stripe PaymentIntent. */
  async retrievePaymentIntent(
    _id: string,
    _options?: { stripeAccount?: string },
  ): Promise<StripePaymentIntent> {
    ensureEnabled('retrievePaymentIntent')
    return pending('retrievePaymentIntent')
  },
  /** Retrieve a Stripe Subscription. */
  async retrieveSubscription(
    _id: string,
    _options?: { stripeAccount?: string },
  ): Promise<StripeSubscription> {
    ensureEnabled('retrieveSubscription')
    return pending('retrieveSubscription')
  },
  /** Retrieve a Stripe Charge. */
  async retrieveCharge(_id: string, _options?: { stripeAccount?: string }): Promise<StripeCharge> {
    ensureEnabled('retrieveCharge')
    return pending('retrieveCharge')
  },
  /** Retrieve a Stripe CheckoutSession. */
  async retrieveCheckoutSession(
    _id: string,
    _options?: { stripeAccount?: string },
  ): Promise<StripeCheckoutSession> {
    ensureEnabled('retrieveCheckoutSession')
    return pending('retrieveCheckoutSession')
  },
  /** Retrieve a Stripe Invoice. */
  async retrieveInvoice(
    _id: string,
    _options?: { stripeAccount?: string },
  ): Promise<StripeInvoice> {
    ensureEnabled('retrieveInvoice')
    return pending('retrieveInvoice')
  },
  /** Create a Stripe Checkout/payment session for a church donation. */
  async createCheckoutSession(_req: CheckoutSessionRequest): Promise<CheckoutSessionResult> {
    ensureEnabled('createCheckoutSession')
    return pending('createCheckoutSession')
  },
  /** Verify a raw webhook signature and parse the typed event. */
  async constructWebhookEvent(rawBody: string, signature: string): Promise<ParsedWebhookEvent> {
    ensureEnabled('constructWebhookEvent')
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) {
      throw new GeneralError({
        code: 500,
        error: 'CONFIGURATION_ERROR',
        error_code: 'STRIPE_WEBHOOK_SECRET_MISSING',
        details: 'Stripe webhook signing secret is not configured.',
      })
    }
    verifyStripeWebhookSignature({ rawBody, signatureHeader: signature, secret })
    return parseStripeWebhookEvent(rawBody)
  },
}
