import { STRIPE, isStripeEnabled } from '@/providers/stripe'
import { withExternalIdempotency } from '@/utils/idempotency'
import { validate } from '@/utils/validate'
import { GeneralError } from '@/utils/general-error'
import {
  GET_DONATIONS,
  GET_DONATION_SUBSCRIPTIONS,
  GET_DONATION_SUMMARY,
  ENSURE_CHURCH_DONATION_ELIGIBLE,
  GET_MY_ACTIVE_GIFT,
  GET_MY_ACTIVE_SUBSCRIPTION,
  GET_CHURCH_LABEL,
  GET_MY_PAID_DONATIONS,
  GET_MY_DONATION_ATTEMPT,
  GET_CHECKOUT_RECEIPT,
  CANCEL_OTHER_CHURCH_SUBSCRIPTIONS,
} from '@/providers/donation'
import { UPSERT_DONATION_SUBSCRIPTION, UPSERT_DONATION_PAYMENT } from '@/providers/payment-sync'
import {
  type DonationListQuery,
  type DonationSubscriptionListQuery,
  type DonationSummary,
  DonationInputSchema,
  type DonationStatus,
  type DonationStatusQuery,
  type MyDonationContribution,
  type MyDonationOverview,
  assertNoRawCardData,
} from '@/models/donation'

/*
 * Donation controller (Tasks 29-30). Routes authenticate + resolve the primary
 * church scope; this controller owns the remaining check that the requested
 * church is inside the resolved grant (404 hides cross-church existence) and
 * delegates scoped reads to the provider. No donor PII ever passes through.
 */

const ensureChurchInScope = (churchId: string, churchIds: Set<string>) => {
  if (!churchIds.has(churchId)) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'RESOURCE_NOT_FOUND',
      details: 'Church not found.',
    })
  }
}

export const listDonations = async ({
  churchId,
  churchIds,
  query,
}: {
  churchId: string
  churchIds: Set<string>
  query: DonationListQuery
}) => {
  ensureChurchInScope(churchId, churchIds)
  return GET_DONATIONS({ churchIds, query })
}

export const listDonationSubscriptions = async ({
  churchId,
  churchIds,
  query,
}: {
  churchId: string
  churchIds: Set<string>
  query: DonationSubscriptionListQuery
}) => {
  ensureChurchInScope(churchId, churchIds)
  return GET_DONATION_SUBSCRIPTIONS({ churchIds, query })
}

export const getDonationSummary = async ({
  churchId,
  churchIds,
  month,
}: {
  churchId: string
  churchIds: Set<string>
  month: string
}): Promise<DonationSummary> => {
  ensureChurchInScope(churchId, churchIds)
  return GET_DONATION_SUMMARY({ churchIds, month })
}

export const initiateDonation = async ({
  churchId,
  userId,
  input,
  idempotencyKey,
}: {
  churchId: string
  userId?: string
  input: unknown
  idempotencyKey?: string
}) => {
  assertNoRawCardData(input)
  const validated = validate(DonationInputSchema, input)
  const church = await ENSURE_CHURCH_DONATION_ELIGIBLE({ churchId })

  const createSession = async () => {
    let customerId: string | undefined
    if (userId && validated.frequency === 'monthly' && isStripeEnabled()) {
      try {
        const activeSub = await GET_MY_ACTIVE_SUBSCRIPTION({ userId })
        if (activeSub) {
          const sub = await STRIPE.retrieveSubscription(activeSub.providerSubscriptionId)
          if (sub.customer) customerId = sub.customer
        }
      } catch {
        // Fallback: create fresh customer in Stripe
      }
    }

    return STRIPE.createCheckoutSession({
      churchId,
      churchName: church.churchName,
      userId,
      amountMinor: validated.amountMinor,
      currency: validated.currency,
      frequency: validated.frequency,
      category: validated.category,
      customerId,
      successUrl:
        validated.successUrl ?? `https://app.prayer.com/churches/${churchId}/donations/success`,
      cancelUrl:
        validated.cancelUrl ?? `https://app.prayer.com/churches/${churchId}/donations/cancel`,
    })
  }

  let session: { sessionId: string; url: string }
  if (idempotencyKey && userId) {
    const idem = await withExternalIdempotency({
      actorKey: userId,
      key: idempotencyKey,
      operation: 'initiate_donation',
      requestBody: input,
      run: async () => {
        const res = await createSession()
        return JSON.stringify(res)
      },
    })
    const raw = idem.resource_id
    if (!raw) {
      throw new GeneralError({
        code: 500,
        error: 'INTERNAL_ERROR',
        error_code: 'IDEMPOTENCY_REPLAY_FAILED',
        details: 'Idempotency record has no session data.',
      })
    }
    try {
      const parsed = JSON.parse(raw)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof parsed.sessionId === 'string' &&
        typeof parsed.url === 'string'
      ) {
        session = parsed
      } else {
        throw new Error('Invalid session format')
      }
    } catch {
      throw new GeneralError({
        code: 500,
        error: 'INTERNAL_ERROR',
        error_code: 'IDEMPOTENCY_REPLAY_FAILED',
        details: 'Stored idempotency session payload is corrupt.',
      })
    }
  } else {
    session = await createSession()
  }
  return {
    sessionId: session.sessionId,
    url: session.url,
    churchId,
    amountMinor: validated.amountMinor,
    currency: validated.currency,
    frequency: validated.frequency,
  }
}

export const getMyActiveGift = async ({ userId }: { userId: string }) =>
  GET_MY_ACTIVE_GIFT({ userId })

/** A fresh checkout can only produce a row within this window; older rows are a different attempt. */
const DONATION_ATTEMPT_WINDOW_MS = 30 * 60 * 1000

/**
 * W12 result-page outcome. Read from our own records, NEVER from the redirect
 * URL: `confirmed` requires a PAID donation row. Everything we cannot prove —
 * including a session Stripe has not reported yet — stays `pending`.
 */
export const getDonationStatus = async ({
  userId,
  query,
}: {
  userId: string
  query: DonationStatusQuery
}): Promise<DonationStatus> => {
  const church = await GET_CHURCH_LABEL({ churchId: query.churchId })
  if (!church) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'CHURCH_NOT_FOUND',
      details: 'Church not found.',
    })
  }

  const [attempt, receipt] = await Promise.all([
    GET_MY_DONATION_ATTEMPT({
      userId,
      churchId: church.id,
      amountMinor: query.amountMinor,
      currency: query.currency,
      frequency: query.frequency,
      since: new Date(Date.now() - DONATION_ATTEMPT_WINDOW_MS),
    }),
    GET_CHECKOUT_RECEIPT({ sessionId: query.sessionId }),
  ])

  if (query.sessionId && isStripeEnabled()) {
    try {
      const session = await STRIPE.retrieveCheckoutSession(query.sessionId)
      const metadataToSync: Record<string, string> = {
        churchId: church.id,
        userId,
      }
      if (session.metadata?.category) metadataToSync.category = session.metadata.category
      if (session.payment_intent) {
        await STRIPE.updatePaymentIntentMetadata(session.payment_intent, metadataToSync)
      }
      const isPaid = session.paymentStatus === 'paid' || session.status === 'complete'
      if (isPaid && session.mode === 'subscription' && session.subscription) {
        const currentSubId = session.subscription
        await UPSERT_DONATION_SUBSCRIPTION({
          churchId: church.id,
          userId,
          providerSubscriptionId: currentSubId,
          amountMinor: query.amountMinor,
          currency: query.currency,
          providerStatus: 'active',
          eventCreated: Math.floor(Date.now() / 1000),
        })
        const paymentId = session.payment_intent || session.id
        await UPSERT_DONATION_PAYMENT({
          churchId: church.id,
          userId,
          providerPaymentId: String(paymentId),
          amountMinor: query.amountMinor,
          currency: query.currency,
          status: 'PAID',
          paidAt: new Date(),
          providerSubscriptionId: currentSubId,
        })
        await CANCEL_OTHER_CHURCH_SUBSCRIPTIONS({
          userId,
          churchId: church.id,
          currentSubscriptionId: currentSubId,
        })
        const sub = await STRIPE.retrieveSubscription(currentSubId).catch(() => null)
        if (sub?.customer) {
          await STRIPE.cancelOtherChurchSubscriptions({
            customerId: sub.customer,
            churchId: church.id,
            currentSubscriptionId: currentSubId,
          })
        }
      } else if (isPaid && session.mode === 'payment') {
        const paymentId = session.payment_intent || session.id
        await UPSERT_DONATION_PAYMENT({
          churchId: church.id,
          userId,
          providerPaymentId: String(paymentId),
          amountMinor: query.amountMinor,
          currency: query.currency,
          status: 'PAID',
          paidAt: new Date(),
        })
      }
    } catch {
      // Best-effort immediate sync; webhook worker serves as eventual consistency backup
    }
  }

  // Re-read attempt if it was just upserted above
  const finalAttempt =
    attempt ??
    (await GET_MY_DONATION_ATTEMPT({
      userId,
      churchId: church.id,
      amountMinor: query.amountMinor,
      currency: query.currency,
      frequency: query.frequency,
      since: new Date(Date.now() - DONATION_ATTEMPT_WINDOW_MS),
    }))

  const base = {
    churchId: church.id,
    churchSlug: church.slug,
    churchName: church.name,
    amountMinor: query.amountMinor,
    currency: query.currency.toUpperCase(),
    frequency: query.frequency,
    receiptSeen: receipt !== null,
  }

  if (finalAttempt?.status === 'PAID' || finalAttempt?.status === 'REFUNDED') {
    return { ...base, state: 'confirmed', paidAt: finalAttempt.paidAt }
  }
  if (finalAttempt?.status === 'FAILED') {
    return { ...base, state: 'failed', paidAt: null }
  }
  return { ...base, state: 'pending', paidAt: null }
}

/**
 * Same wall-clock day next month (UTC), clamped to the shorter month. Used only
 * as a next-charge estimate for an active pledge: the provider owns the real
 * billing date, which we do not store yet.
 */
const nextMonthlyCharge = (from: Date) => {
  const monthStart = new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth() + 1,
      1,
      from.getUTCHours(),
      from.getUTCMinutes(),
    ),
  )
  const daysInMonth = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
  ).getUTCDate()
  monthStart.setUTCDate(Math.min(from.getUTCDate(), daysInMonth))
  return monthStart
}

/** W11 right column: the signed-in giver's own stewardship for the current year, per currency. */
export const getMyDonationOverview = async ({
  userId,
}: {
  userId: string
}): Promise<MyDonationOverview> => {
  const year = new Date().getUTCFullYear()
  const [activeGift, rows] = await Promise.all([
    GET_MY_ACTIVE_GIFT({ userId }),
    GET_MY_PAID_DONATIONS({
      userId,
      from: new Date(Date.UTC(year, 0, 1)),
      to: new Date(Date.UTC(year + 1, 0, 1)),
    }),
  ])

  const byCurrency = new Map<string, MyDonationContribution>()
  for (const row of rows) {
    const entry = byCurrency.get(row.currency) ?? {
      currency: row.currency,
      totalMinor: 0,
      count: 0,
      months: [],
    }
    entry.totalMinor += row.amountMinor
    entry.count += 1
    const month = row.paidAt?.getUTCMonth()
    if (month !== undefined && !entry.months.includes(month)) entry.months.push(month)
    byCurrency.set(row.currency, entry)
  }
  const contributions = Array.from(byCurrency.values()).sort(
    (a, b) => b.count - a.count || a.currency.localeCompare(b.currency),
  )

  // Rows arrive newest first, so the first match is the latest gift to that parish.
  const lastPaidAt =
    activeGift === null
      ? null
      : (rows.find((row) => row.churchId === activeGift.churchId)?.paidAt ?? null)

  return {
    year,
    activeGift,
    contributions,
    lastPaidAt,
    nextGiftAt: lastPaidAt ? nextMonthlyCharge(lastPaidAt) : null,
  }
}

/**
 * W11 "Pause or Modify Monthly Pledge": hands the giver to Stripe's own billing
 * portal, where the subscription is actually paused or changed. We never mutate
 * a subscription here, and a giver with no active pledge has nothing to manage.
 */
export const openBillingPortal = async ({
  userId,
  returnUrl,
}: {
  userId: string
  returnUrl: string
}): Promise<{ url: string }> => {
  const subscription = await GET_MY_ACTIVE_SUBSCRIPTION({ userId })
  if (!subscription) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'NO_ACTIVE_SUBSCRIPTION',
      details: 'There is no active monthly pledge to manage.',
    })
  }

  const provider = await STRIPE.retrieveSubscription(subscription.providerSubscriptionId)
  if (!provider.customer) {
    throw new GeneralError({
      code: 502,
      error: 'PAYMENT_ERROR',
      error_code: 'STRIPE_CUSTOMER_MISSING',
      details: 'The provider subscription has no customer to open a portal for.',
    })
  }

  return STRIPE.createBillingPortalSession({ customerId: provider.customer, returnUrl })
}
