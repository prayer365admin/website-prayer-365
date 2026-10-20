import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import { STRIPE, isStripeEnabled } from '@/providers/stripe'
import { logger } from '@/utils/logger'

export async function GET_PAYMENT_SYNC_CONTEXT({ receiptId }: { receiptId?: string }) {
  const receipt = receiptId
    ? await db.webhookReceipt.findUnique({ where: { id: receiptId } })
    : null

  return { receipt }
}

/**
 * Recurring invoice events carry no checkout metadata (only the first payment
 * does), so church/giver attribution for a renewal falls back to the stored
 * subscription row created by `customer.subscription.*`.
 */
export async function GET_DONATION_SUBSCRIPTION_OWNER({
  providerSubscriptionId,
}: {
  providerSubscriptionId: string
}) {
  return db.donationSubscription.findUnique({
    where: { provider_subscription_id: providerSubscriptionId },
    select: { church_id: true, user_id: true },
  })
}

export async function UPSERT_DONATION_SUBSCRIPTION({
  churchId,
  providerSubscriptionId,
  amountMinor,
  currency,
  providerStatus,
  eventCreated,
  userId,
}: {
  churchId: string
  providerSubscriptionId: string
  amountMinor: number
  currency: string
  providerStatus: string
  eventCreated: number
  userId?: string | null
}) {
  let priorToCancel: string[] = []

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.donationSubscription.findUnique({
      where: {
        provider_subscription_id: providerSubscriptionId,
      },
    })

    const effectiveUserId = userId || existing?.user_id
    if (providerStatus === 'active' && effectiveUserId && churchId) {
      const priorActive = await tx.donationSubscription.findMany({
        where: {
          user_id: effectiveUserId,
          church_id: churchId,
          provider_status: 'active',
          provider_subscription_id: { not: providerSubscriptionId },
        },
        select: { id: true, provider_subscription_id: true },
      })
      if (priorActive.length > 0) {
        await tx.donationSubscription.updateMany({
          where: { id: { in: priorActive.map((s) => s.id) } },
          data: { provider_status: 'canceled' },
        })
        priorToCancel = priorActive.map((s) => s.provider_subscription_id)
      }
    }

    if (existing) {
      const isCanceled = existing.provider_status === 'canceled'
      const isIncomingNonTerminal = providerStatus !== 'canceled'
      const existingTime = existing.updated_at
        ? existing.updated_at.getTime()
        : existing.created_at.getTime()
      const isStale = eventCreated * 1000 < existingTime

      if (isCanceled && isIncomingNonTerminal && isStale) {
        return existing
      }

      return tx.donationSubscription.update({
        where: { id: existing.id },
        data: {
          church_id: churchId,
          amount_minor: amountMinor,
          currency: currency.toLowerCase(),
          provider_status: providerStatus,
          user_id: effectiveUserId,
        },
      })
    }

    return tx.donationSubscription.create({
      data: {
        church_id: churchId,
        provider_subscription_id: providerSubscriptionId,
        amount_minor: amountMinor,
        currency: currency.toLowerCase(),
        provider_status: providerStatus,
        user_id: effectiveUserId || null,
      },
    })
  })

  if (isStripeEnabled() && priorToCancel.length > 0) {
    for (const subId of priorToCancel) {
      await STRIPE.cancelSubscription(subId).catch((err) => {
        logger.warn('failed_to_cancel_prior_subscription_in_stripe', {
          subscription_id: subId,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }
  }

  return result
}

export async function UPSERT_DONATION_PAYMENT({
  churchId,
  providerPaymentId,
  amountMinor,
  currency,
  status,
  paidAt,
  providerSubscriptionId,
  userId,
}: {
  churchId: string
  providerPaymentId: string
  amountMinor: number
  currency: string
  status: string
  paidAt: Date | null
  providerSubscriptionId?: string
  userId?: string | null
}) {
  let priorToCancel: string[] = []

  const result = await db.$transaction(async (tx) => {
    let subscriptionId: string | null = null

    if (providerSubscriptionId) {
      let sub = await tx.donationSubscription.findUnique({
        where: {
          provider_subscription_id: providerSubscriptionId,
        },
      })
      if (!sub) {
        sub = await tx.donationSubscription.create({
          data: {
            church_id: churchId,
            provider_subscription_id: providerSubscriptionId,
            amount_minor: 0, // Placeholder
            currency: currency.toLowerCase(),
            provider_status: 'active', // Placeholder
            user_id: userId || null,
          },
        })
      } else {
        const updateData: { church_id?: string; user_id?: string } = {}
        if (sub.church_id !== churchId) updateData.church_id = churchId
        if (!sub.user_id && userId) updateData.user_id = userId
        if (Object.keys(updateData).length > 0) {
          sub = await tx.donationSubscription.update({
            where: { id: sub.id },
            data: updateData,
          })
        }
      }

      if (userId && sub.provider_status === 'active') {
        const priorActive = await tx.donationSubscription.findMany({
          where: {
            user_id: userId,
            church_id: churchId,
            provider_status: 'active',
            id: { not: sub.id },
          },
          select: { id: true, provider_subscription_id: true },
        })
        if (priorActive.length > 0) {
          await tx.donationSubscription.updateMany({
            where: { id: { in: priorActive.map((s) => s.id) } },
            data: { provider_status: 'canceled' },
          })
          priorToCancel = priorActive.map((s) => s.provider_subscription_id)
        }
      }

      subscriptionId = sub.id
    }

    const existing = await tx.donation.findUnique({
      where: {
        provider_payment_id: providerPaymentId,
      },
    })

    if (existing) {
      if (existing.status === 'PAID' && status === 'FAILED') {
        // Enforce stale-event guard: preserve PAID, ignore stale failure
        return existing
      }
      if (existing.status === 'FAILED' && status === 'PAID') {
        // Update status to PAID and reconcile church_id if drifted
        return tx.donation.update({
          where: { id: existing.id },
          data: {
            church_id: churchId,
            status: 'PAID',
            paid_at: paidAt,
            amount_minor: amountMinor,
            currency: currency.toLowerCase(),
            subscription_id: subscriptionId || existing.subscription_id,
            user_id: userId || existing.user_id,
          },
        })
      }
      if (existing.status === 'PAID' && status === 'PAID') {
        // Reconcile church_id if drifted, otherwise idempotent no-op
        if (existing.church_id !== churchId) {
          return tx.donation.update({
            where: { id: existing.id },
            data: { church_id: churchId },
          })
        }
        return existing
      }
      return tx.donation.update({
        where: { id: existing.id },
        data: {
          church_id: churchId,
          status,
          paid_at: paidAt,
          amount_minor: amountMinor,
          currency: currency.toLowerCase(),
          subscription_id: subscriptionId || existing.subscription_id,
          user_id: userId || existing.user_id,
        },
      })
    }

    return tx.donation.create({
      data: {
        church_id: churchId,
        provider_payment_id: providerPaymentId,
        amount_minor: amountMinor,
        currency: currency.toLowerCase(),
        status,
        paid_at: paidAt,
        subscription_id: subscriptionId,
        user_id: userId || null,
      },
    })
  })

  if (isStripeEnabled() && priorToCancel.length > 0) {
    for (const subId of priorToCancel) {
      await STRIPE.cancelSubscription(subId).catch((err) => {
        logger.warn('failed_to_cancel_prior_subscription_in_stripe', {
          subscription_id: subId,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }
  }

  return result
}

export async function APPLY_DONATION_REFUND({
  providerPaymentId,
  fallbackPaymentId,
  refundedMinor,
}: {
  providerPaymentId: string
  fallbackPaymentId?: string
  refundedMinor: number
}) {
  return await db.$transaction(async (tx) => {
    let existing = await tx.donation.findUnique({
      where: {
        provider_payment_id: providerPaymentId,
      },
    })

    if (!existing && fallbackPaymentId) {
      existing = await tx.donation.findUnique({
        where: {
          provider_payment_id: fallbackPaymentId,
        },
      })
    }
    if (!existing) {
      throw new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'DONATION_NOT_FOUND',
        details: `Donation not found for payment ${providerPaymentId}`,
      })
    }
    const newRefunded = BigInt(refundedMinor)
    const nextRefunded =
      newRefunded > existing.refunded_minor ? newRefunded : existing.refunded_minor
    const isFullyRefunded = nextRefunded >= existing.amount_minor

    return tx.donation.update({
      where: { id: existing.id },
      data: {
        refunded_minor: nextRefunded,
        status: isFullyRefunded ? 'REFUNDED' : existing.status,
      },
    })
  })
}

export async function FINALIZE_PAYMENT_SYNC_JOB({
  jobId,
  receiptId,
  state,
  errorCode,
}: {
  jobId: string
  receiptId?: string
  state: 'SUCCEEDED' | 'FAILED'
  errorCode?: string
}) {
  return await db.$transaction(async (tx) => {
    const job = await tx.outboxJob.update({
      where: { id: jobId },
      data: {
        state,
        last_error_code: errorCode,
      },
    })

    if (receiptId) {
      if (state === 'SUCCEEDED') {
        await tx.webhookReceipt.update({
          where: { id: receiptId },
          data: {
            state: 'PROCESSED',
            processed_at: new Date(),
          },
        })
      } else {
        await tx.webhookReceipt.update({
          where: { id: receiptId },
          data: {
            state: 'FAILED',
          },
        })
      }
    }

    return job
  })
}
