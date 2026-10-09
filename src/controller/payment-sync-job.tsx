import crypto from 'node:crypto'
import { GeneralError } from '@/utils/general-error'
import { CLAIM_PENDING_JOBS, GET_JOB, MARK_JOB_STATE } from '@/providers/outbox-job'
import {
  GET_PAYMENT_SYNC_CONTEXT,
  UPSERT_DONATION_SUBSCRIPTION,
  UPSERT_DONATION_PAYMENT,
  APPLY_DONATION_REFUND,
  FINALIZE_PAYMENT_SYNC_JOB,
} from '@/providers/payment-sync'
import { STRIPE, isStripeEnabled } from '@/providers/stripe'

const MAX_ATTEMPTS = 3
const REFUND_MAX_ATTEMPTS = 10
const backoff = (attempts: number) => new Date(Date.now() + 30_000 * 2 ** attempts)
export type JobOutcome = 'succeeded' | 'failed' | 'requeued' | 'skipped'
export type JobSummary = {
  claimed: number
  succeeded: number
  failed: number
  requeued: number
  skipped: number
}

const requeueOrFail = async (
  job: { id: string; attempts: number; resource_id: string | null },
  errorCode: string,
): Promise<JobOutcome> => {
  if (job.attempts >= MAX_ATTEMPTS) {
    await FINALIZE_PAYMENT_SYNC_JOB({
      jobId: job.id,
      receiptId: job.resource_id ?? undefined,
      state: 'FAILED',
      errorCode,
    })
    return 'failed'
  }
  await MARK_JOB_STATE({
    jobId: job.id,
    state: 'PENDING',
    errorCode,
    availableAt: backoff(job.attempts),
  })
  return 'requeued'
}

export const processPaymentSyncJob = async (
  jobId: string,
  _requestId: string,
): Promise<JobOutcome> => {
  const job = await GET_JOB({ jobId })
  if (!job || job.state !== 'RUNNING') return 'skipped'
  if (!job.payload) return requeueOrFail(job, 'MISSING_PAYLOAD')

  const payload = job.payload as {
    eventId: string
    eventType: string
    objectId: string
    paymentAccountId: string
    churchId: string
    eventCreated?: number
    dataObject?: Record<string, unknown>
  }

  const { receipt, account } = await GET_PAYMENT_SYNC_CONTEXT({
    receiptId: job.resource_id ?? undefined,
    paymentAccountId: payload.paymentAccountId,
  })

  if (!account) return requeueOrFail(job, 'PAYMENT_ACCOUNT_MISSING')
  if (receipt?.state === 'PROCESSED') {
    await FINALIZE_PAYMENT_SYNC_JOB({ jobId: job.id, state: 'SUCCEEDED' })
    return 'succeeded'
  }

  try {
    let obj = payload.dataObject
    if (!obj && isStripeEnabled()) {
      if (payload.eventType.startsWith('payment_intent.')) {
        obj = (await STRIPE.retrievePaymentIntent(payload.objectId)) as unknown as Record<
          string,
          unknown
        >
      } else if (payload.eventType.startsWith('charge.')) {
        obj = (await STRIPE.retrieveCharge(payload.objectId)) as unknown as Record<string, unknown>
      } else if (payload.eventType.startsWith('customer.subscription.')) {
        obj = (await STRIPE.retrieveSubscription(payload.objectId)) as unknown as Record<
          string,
          unknown
        >
      } else if (payload.eventType.startsWith('checkout.session.')) {
        obj = (await STRIPE.retrieveCheckoutSession(payload.objectId)) as unknown as Record<
          string,
          unknown
        >
      } else if (payload.eventType.startsWith('invoice.')) {
        obj = (await STRIPE.retrieveInvoice(payload.objectId)) as unknown as Record<string, unknown>
      }
    }

    if (!obj) return requeueOrFail(job, 'MISSING_EVENT_OBJECT')

    const eventCreated = payload.eventCreated || Math.floor(Date.now() / 1000)
    /** Provider event time; processing time would bucket events into the wrong
     * monthly summary when a backlog drains after a month boundary. */
    const providerPaidAt = new Date(eventCreated * 1000)

    if (payload.eventType === 'payment_intent.succeeded') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pi = obj as any
      const subscriptionId =
        pi.subscription ??
        (pi.invoice
          ? pi.subscription || (pi.metadata && pi.metadata.subscription_id)
          : undefined) ??
        (pi.metadata && pi.metadata.subscription_id)
      await UPSERT_DONATION_PAYMENT({
        paymentAccountId: payload.paymentAccountId,
        providerPaymentId: String(pi.id),
        amountMinor: Number(pi.amount),
        currency: String(pi.currency),
        status: 'PAID',
        paidAt: providerPaidAt,
        providerSubscriptionId: subscriptionId ? String(subscriptionId) : undefined,
      })
    } else if (payload.eventType === 'payment_intent.payment_failed') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pi = obj as any
      await UPSERT_DONATION_PAYMENT({
        paymentAccountId: payload.paymentAccountId,
        providerPaymentId: String(pi.id),
        amountMinor: Number(pi.amount),
        currency: String(pi.currency),
        status: 'FAILED',
        paidAt: null,
      })
    } else if (payload.eventType === 'charge.succeeded') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ch = obj as any
      await UPSERT_DONATION_PAYMENT({
        paymentAccountId: payload.paymentAccountId,
        providerPaymentId:
          typeof ch.payment_intent === 'string'
            ? ch.payment_intent
            : ch.payment_intent?.id || ch.id,
        amountMinor: Number(ch.amount),
        currency: String(ch.currency),
        status: 'PAID',
        paidAt: providerPaidAt,
      })
    } else if (payload.eventType === 'charge.failed') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ch = obj as any
      if (ch.payment_intent != null) {
        const providerPaymentId =
          typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id || ch.id
        await UPSERT_DONATION_PAYMENT({
          paymentAccountId: payload.paymentAccountId,
          providerPaymentId: String(providerPaymentId),
          amountMinor: Number(ch.amount ?? 0),
          currency: String(ch.currency ?? 'usd'),
          status: 'FAILED',
          paidAt: null,
        })
      }
    } else if (payload.eventType === 'charge.refunded') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ch = obj as any
      const primaryId =
        typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id || ch.id
      const fallbackId = ch.id
      await APPLY_DONATION_REFUND({
        paymentAccountId: payload.paymentAccountId,
        providerPaymentId: primaryId,
        fallbackPaymentId: fallbackId !== primaryId ? fallbackId : undefined,
        refundedMinor: Number(ch.amount_refunded),
      })
    } else if (
      payload.eventType === 'customer.subscription.created' ||
      payload.eventType === 'customer.subscription.updated'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = obj as any
      const amount = Number(sub.plan?.amount ?? sub.items?.data?.[0]?.price?.unit_amount ?? 0)
      const currency = String(sub.plan?.currency ?? sub.items?.data?.[0]?.price?.currency ?? 'usd')
      await UPSERT_DONATION_SUBSCRIPTION({
        paymentAccountId: payload.paymentAccountId,
        providerSubscriptionId: String(sub.id),
        amountMinor: amount,
        currency: currency,
        providerStatus: String(sub.status),
        eventCreated,
      })
    } else if (payload.eventType === 'customer.subscription.deleted') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = obj as any
      const amount = Number(sub.plan?.amount ?? sub.items?.data?.[0]?.price?.unit_amount ?? 0)
      const currency = String(sub.plan?.currency ?? sub.items?.data?.[0]?.price?.currency ?? 'usd')
      await UPSERT_DONATION_SUBSCRIPTION({
        paymentAccountId: payload.paymentAccountId,
        providerSubscriptionId: String(sub.id),
        amountMinor: amount,
        currency: currency,
        providerStatus: 'canceled',
        eventCreated,
      })
    } else if (payload.eventType === 'checkout.session.completed') {
      // See SPEC: handle if needed
    } else if (payload.eventType === 'invoice.payment_succeeded') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inv = obj as any
      const pi = inv.payment_intent
      const paymentId = typeof pi === 'string' ? pi : pi?.id || inv.id
      await UPSERT_DONATION_PAYMENT({
        paymentAccountId: payload.paymentAccountId,
        providerPaymentId: String(paymentId),
        amountMinor: Number(inv.amount_paid ?? inv.total ?? 0),
        currency: String(inv.currency ?? 'usd'),
        status: 'PAID',
        paidAt: providerPaidAt,
        providerSubscriptionId: inv.subscription ? String(inv.subscription) : undefined,
      })
    } else if (payload.eventType === 'invoice.payment_failed') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inv = obj as any
      const paymentId =
        typeof inv.payment_intent === 'string'
          ? inv.payment_intent
          : inv.payment_intent?.id || inv.id
      await UPSERT_DONATION_PAYMENT({
        paymentAccountId: payload.paymentAccountId,
        providerPaymentId: String(paymentId),
        amountMinor: Number(inv.amount_due ?? inv.total ?? 0),
        currency: String(inv.currency ?? 'usd'),
        status: 'FAILED',
        paidAt: null,
        providerSubscriptionId: inv.subscription ? String(inv.subscription) : undefined,
      })
    }

    await FINALIZE_PAYMENT_SYNC_JOB({
      jobId: job.id,
      receiptId: job.resource_id ?? undefined,
      state: 'SUCCEEDED',
    })
    return 'succeeded'
  } catch (e: unknown) {
    if (
      e instanceof GeneralError &&
      e.error_code === 'DONATION_NOT_FOUND' &&
      job.attempts < REFUND_MAX_ATTEMPTS
    ) {
      await MARK_JOB_STATE({
        jobId: job.id,
        state: 'PENDING',
        errorCode: 'DONATION_NOT_FOUND',
        availableAt: backoff(Math.min(job.attempts, 5)),
      })
      return 'requeued'
    }
    const code =
      e instanceof GeneralError
        ? e.error_code
        : e instanceof Error && 'code' in e
          ? String(e.code)
          : 'INTERNAL_JOB_ERROR'
    return requeueOrFail(job, code)
  }
}

export const runPaymentSyncTick = async ({
  limit = 5,
}: { limit?: number } = {}): Promise<JobSummary> => {
  const claimed = await CLAIM_PENDING_JOBS({ kind: 'payment.sync', limit })
  const summary: JobSummary = {
    claimed: claimed.length,
    succeeded: 0,
    failed: 0,
    requeued: 0,
    skipped: 0,
  }
  for (const job of claimed) {
    try {
      const outcome = await processPaymentSyncJob(job.id, crypto.randomUUID())
      summary[outcome]++
    } catch {
      summary.skipped++
      await MARK_JOB_STATE({
        jobId: job.id,
        state: 'PENDING',
        errorCode: 'INTERNAL_JOB_ERROR',
        availableAt: backoff(0),
      }).catch(() => undefined)
    }
  }
  return summary
}
