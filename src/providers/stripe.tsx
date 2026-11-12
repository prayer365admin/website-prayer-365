import Stripe from 'stripe'
import { NotImplementedError } from '@/utils/not-implemented-error'
import { GeneralError } from '@/utils/general-error'
import { DonationCategory } from '@/models/donation'
import { logger } from '@/utils/logger'
import { verifyStripeWebhookSignature, parseStripeWebhookEvent } from './stripe-webhook'

/*
 * Stripe external-service adapter (SPEC 9.6 / plan Task 45).
 *
 * Checkout creation and checkout-session retrieval are wired to the Stripe SDK
 * (WB-40): the website starts a session, Stripe redirects the giver, and the
 * webhook → payment.sync worker path writes the Donation row this adapter never
 * touches. Every OTHER method is still a stub that throws NotImplementedError
 * and never returns a value that looks like success — those paths belong to the
 * Phase 10 worker/reconciliation deliverable.
 */

/** 31 min: just past the 30-minute attempt window, and over Stripe's 30-minute minimum. */
const CHECKOUT_TTL_SECONDS = 31 * 60

const PENDING_MESSAGE = 'external integration pending — see Phase 10 worker/webhook deliverable'

/** One lazily-created SDK client; the platform uses a single Stripe account (no Connect per church). */
let client: Stripe | null = null

const makeStripe = (): Stripe => {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new GeneralError({
      code: 500,
      error: 'CONFIGURATION_ERROR',
      error_code: 'STRIPE_SECRET_KEY_MISSING',
      details: 'Stripe secret key is not configured.',
    })
  }
  client ??= new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000 })
  return client
}

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

export const PLATFORM_ACCOUNT_ID = (): string => {
  const id = process.env.STRIPE_PLATFORM_ACCOUNT_ID
  if (!id) {
    throw new GeneralError({
      code: 500,
      error: 'CONFIGURATION_ERROR',
      error_code: 'STRIPE_PLATFORM_ACCOUNT_ID_MISSING',
      details: 'Stripe platform account id is not configured.',
    })
  }
  return id
}

export interface CheckoutSessionRequest {
  churchId: string
  amountMinor: number
  currency: string
  frequency: 'one_time' | 'monthly'
  successUrl: string
  cancelUrl: string
  /** Signed-in giver; copied into session metadata so payment.sync can attribute the row. */
  userId?: string
  /** Resolved by the caller that already loaded the church; omitted → generic product name. */
  churchName?: string
  /** Ministry designation from the form; copied into transaction metadata. */
  category?: DonationCategory
  /** Existing Stripe Customer ID, if known for this giver. */
  customerId?: string
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
  /** Owning Customer id — the key the billing portal is opened for. */
  customer?: string
  /** Unix timestamp when the customer canceled the subscription, or null. */
  canceledAt?: number | null
  /** Unix timestamp when cancellation takes effect, or null. */
  cancelAt?: number | null
  /** True when the subscription is marked to end or has already been canceled. */
  cancelAtPeriodEnd?: boolean
  plan?: {
    amount: number
    currency: string
  }
  metadata?: Record<string, string>
}

export interface StripeBillingPortalSession {
  url: string
}
export interface StripeCheckoutSession {
  id: string
  mode: string
  status?: string | null
  paymentStatus?: string | null
  /** Set only in `payment` mode; a monthly session carries the payment on its invoice. */
  payment_intent?: string
  subscription?: string
  /** Invoice that holds the money movement for `subscription` mode. */
  invoice?: string
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

/** `invoice.payments[]` entry — the money movement of a subscription invoice. */
export interface StripeInvoicePayment {
  status: string
  payment: { payment_intent?: string; charge?: string }
}

export interface StripeInvoice {
  id: string
  /** Removed from the Invoice object in API 2025-03-31; kept for legacy payloads. */
  payment_intent?: string | { id: string }
  /** Same list shape Stripe sends in webhook payloads, so one resolver reads both. */
  payments?: { data: StripeInvoicePayment[] }
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
    id: string,
    _options?: { stripeAccount?: string },
  ): Promise<StripeSubscription> {
    ensureEnabled('retrieveSubscription')
    const sub = await makeStripe().subscriptions.retrieve(id)
    const price = sub.items.data[0]?.price
    return {
      id: sub.id,
      status: sub.status,
      customer: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
      canceledAt: sub.canceled_at ?? null,
      cancelAt: sub.cancel_at ?? null,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at || sub.canceled_at),
      plan:
        price && price.unit_amount !== null
          ? { amount: price.unit_amount, currency: price.currency }
          : undefined,
      metadata: sub.metadata ?? undefined,
    }
  },
  /** Cancel a Stripe Subscription. */
  async cancelSubscription(id: string): Promise<StripeSubscription> {
    ensureEnabled('cancelSubscription')
    const sub = await makeStripe().subscriptions.cancel(id)
    return {
      id: sub.id,
      status: sub.status,
    }
  },
  /** Retrieve a Stripe Charge. */
  async retrieveCharge(_id: string, _options?: { stripeAccount?: string }): Promise<StripeCharge> {
    ensureEnabled('retrieveCharge')
    return pending('retrieveCharge')
  },
  /** Retrieve a Stripe CheckoutSession. */
  async retrieveCheckoutSession(
    id: string,
    options?: { stripeAccount?: string },
  ): Promise<StripeCheckoutSession> {
    ensureEnabled('retrieveCheckoutSession')
    const session = await makeStripe().checkout.sessions.retrieve(
      id,
      {},
      options?.stripeAccount ? { stripeAccount: options.stripeAccount } : undefined,
    )
    return {
      id: session.id,
      mode: session.mode,
      status: session.status ?? null,
      paymentStatus: session.payment_status ?? null,
      payment_intent:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id,
      subscription:
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
      invoice: typeof session.invoice === 'string' ? session.invoice : session.invoice?.id,
      metadata: session.metadata ?? undefined,
    }
  },
  /** Retrieve a Stripe Invoice, including the `payments` list that now carries its payment intent. */
  async retrieveInvoice(id: string, options?: { stripeAccount?: string }): Promise<StripeInvoice> {
    ensureEnabled('retrieveInvoice')
    // `payments` is an includable sub-list: without the expand the response has no
    // payment intent at all, which is what made callers fall back to the invoice id.
    const invoice = await makeStripe().invoices.retrieve(
      id,
      { expand: ['payments'] },
      options?.stripeAccount ? { stripeAccount: options.stripeAccount } : undefined,
    )
    const subscription = invoice.parent?.subscription_details?.subscription
    return {
      id: invoice.id,
      payments: invoice.payments
        ? {
            data: invoice.payments.data.map((entry) => ({
              status: entry.status,
              payment: {
                payment_intent:
                  typeof entry.payment.payment_intent === 'string'
                    ? entry.payment.payment_intent
                    : entry.payment.payment_intent?.id,
                charge: typeof entry.payment.charge === 'string' ? entry.payment.charge : undefined,
              },
            })),
          }
        : undefined,
      subscription: typeof subscription === 'string' ? subscription : subscription?.id,
      amount_paid: invoice.amount_paid ?? invoice.total,
      total: invoice.total,
      currency: invoice.currency,
    }
  },
  /** Create a Stripe Checkout/payment session for a church donation. */
  async createCheckoutSession(req: CheckoutSessionRequest): Promise<CheckoutSessionResult> {
    ensureEnabled('createCheckoutSession')
    // Church attribution is the contract the payment.sync worker keys Donation
    // rows on (docs/STRIPE.md); userId lets the worker attribute the row to the
    // signed-in giver so the website can show their own stewardship.
    const metadata: Record<string, string> = { churchId: req.churchId }
    if (req.userId) metadata.userId = req.userId
    // The giver's chosen designation travels with the transaction so the parish
    // can sort gifts by ministry in Stripe without a second lookup.
    if (req.category) metadata.category = req.category

    const session = await makeStripe().checkout.sessions.create({
      mode: req.frequency === 'monthly' ? 'subscription' : 'payment',
      ...(req.customerId ? { customer: req.customerId } : {}),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: req.currency.toLowerCase(),
            unit_amount: req.amountMinor,
            product_data: {
              name: req.churchName ? `${req.churchName} offering` : 'Prayer 365 offering',
            },
            ...(req.frequency === 'monthly' ? { recurring: { interval: 'month' as const } } : {}),
          },
        },
      ],
      // Abandoned pages close themselves a little after the 30-minute attempt window the status
      // read honours (Stripe's minimum is 30 minutes from creation; its default is 24 hours).
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SECONDS,
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
      metadata,
      // Stripe rejects payment_intent_data in subscription mode and
      // subscription_data in payment mode, so exactly one is sent.
      ...(req.frequency === 'monthly'
        ? { subscription_data: { metadata } }
        : { payment_intent_data: { metadata } }),
    })
    if (!session.url) {
      throw new GeneralError({
        code: 502,
        error: 'PAYMENT_ERROR',
        error_code: 'STRIPE_SESSION_URL_MISSING',
        details: 'Stripe did not return a checkout url for the session.',
      })
    }
    return { sessionId: session.id, url: session.url }
  },
  /**
   * Expire an OPEN Checkout Session so its hosted page can no longer take a payment. Stripe rejects
   * this for a session that is already complete or expired; the caller handles that.
   */
  async expireCheckoutSession(id: string): Promise<void> {
    ensureEnabled('expireCheckoutSession')
    await makeStripe().checkout.sessions.expire(id)
  },
  /**
   * Open the Stripe-hosted billing portal for a Customer. The giver pauses or
   * changes their own pledge there — we never mutate a subscription directly.
   */
  async createBillingPortalSession({
    customerId,
    returnUrl,
  }: {
    customerId: string
    returnUrl: string
  }): Promise<StripeBillingPortalSession> {
    ensureEnabled('createBillingPortalSession')
    const session = await makeStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    if (!session.url) {
      throw new GeneralError({
        code: 502,
        error: 'PAYMENT_ERROR',
        error_code: 'STRIPE_PORTAL_URL_MISSING',
        details: 'Stripe did not return a billing portal url.',
      })
    }
    return { url: session.url }
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
  /**
   * Cancel any other active subscriptions in Stripe for the same church and customer.
   */
  async cancelOtherChurchSubscriptions({
    customerId,
    churchId,
    currentSubscriptionId,
  }: {
    customerId: string
    churchId: string
    currentSubscriptionId?: string
  }): Promise<string[]> {
    ensureEnabled('cancelSubscription')
    const subs = await makeStripe().subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 20,
    })
    const canceled: string[] = []
    for (const sub of subs.data) {
      if (sub.id === currentSubscriptionId) continue
      if (sub.metadata?.churchId === churchId) {
        await makeStripe()
          .subscriptions.cancel(sub.id)
          .catch((err) => {
            logger.warn('failed_to_cancel_stripe_subscription', {
              subscription_id: sub.id,
              error: err instanceof Error ? err.message : String(err),
            })
          })
        canceled.push(sub.id)
      }
    }
    return canceled
  },
  /** Attach or update metadata on a PaymentIntent in Stripe. */
  async updatePaymentIntentMetadata(id: string, metadata: Record<string, string>): Promise<void> {
    ensureEnabled('retrievePaymentIntent')
    await makeStripe()
      .paymentIntents.update(id, { metadata })
      .catch((err) => {
        logger.warn('failed_to_update_payment_intent_metadata', { id, err })
      })
  },
  /** Attach or update metadata on a Charge in Stripe. */
  async updateChargeMetadata(id: string, metadata: Record<string, string>): Promise<void> {
    ensureEnabled('retrieveCharge')
    await makeStripe()
      .charges.update(id, { metadata })
      .catch((err) => {
        logger.warn('failed_to_update_charge_metadata', { id, err })
      })
  },
}
