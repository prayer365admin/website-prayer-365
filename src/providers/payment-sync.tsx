import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'

export async function GET_PAYMENT_SYNC_CONTEXT({
  receiptId,
  paymentAccountId,
}: {
  receiptId?: string
  paymentAccountId: string
}) {
  const [receipt, account] = await Promise.all([
    receiptId ? db.webhookReceipt.findUnique({ where: { id: receiptId } }) : Promise.resolve(null),
    db.paymentAccount.findUnique({
      where: { id: paymentAccountId },
      include: { church: true },
    }),
  ])

  return { receipt, account }
}

export async function UPSERT_DONATION_SUBSCRIPTION({
  paymentAccountId,
  providerSubscriptionId,
  amountMinor,
  currency,
  providerStatus,
  eventCreated,
  userId,
}: {
  paymentAccountId: string
  providerSubscriptionId: string
  amountMinor: number
  currency: string
  providerStatus: string
  eventCreated: number
  userId?: string | null
}) {
  return await db.$transaction(async (tx) => {
    const existing = await tx.donationSubscription.findUnique({
      where: {
        payment_account_id_provider_subscription_id: {
          payment_account_id: paymentAccountId,
          provider_subscription_id: providerSubscriptionId,
        },
      },
    })

    if (existing) {
      const isCanceled = existing.provider_status === 'canceled'
      const isIncomingNonTerminal = providerStatus !== 'canceled'
      const existingTime = existing.updated_at
        ? existing.updated_at.getTime()
        : existing.created_at.getTime()
      const isStale = eventCreated * 1000 < existingTime

      if (isCanceled && isIncomingNonTerminal && isStale) {
        // Enforce stale-event guard: if existing status is canceled and incoming is non-terminal with an older timestamp, preserve canceled.
        return existing
      }

      return tx.donationSubscription.update({
        where: { id: existing.id },
        data: {
          amount_minor: amountMinor,
          currency: currency.toLowerCase(),
          provider_status: providerStatus,
          user_id: userId || existing.user_id,
        },
      })
    }

    return tx.donationSubscription.create({
      data: {
        payment_account_id: paymentAccountId,
        provider_subscription_id: providerSubscriptionId,
        amount_minor: amountMinor,
        currency: currency.toLowerCase(),
        provider_status: providerStatus,
        user_id: userId || null,
      },
    })
  })
}

export async function UPSERT_DONATION_PAYMENT({
  paymentAccountId,
  providerPaymentId,
  amountMinor,
  currency,
  status,
  paidAt,
  providerSubscriptionId,
  userId,
}: {
  paymentAccountId: string
  providerPaymentId: string
  amountMinor: number
  currency: string
  status: string
  paidAt: Date | null
  providerSubscriptionId?: string
  userId?: string | null
}) {
  return await db.$transaction(async (tx) => {
    let subscriptionId: string | null = null

    if (providerSubscriptionId) {
      let sub = await tx.donationSubscription.findUnique({
        where: {
          payment_account_id_provider_subscription_id: {
            payment_account_id: paymentAccountId,
            provider_subscription_id: providerSubscriptionId,
          },
        },
      })
      if (!sub) {
        sub = await tx.donationSubscription.create({
          data: {
            payment_account_id: paymentAccountId,
            provider_subscription_id: providerSubscriptionId,
            amount_minor: 0, // Placeholder
            currency: currency.toLowerCase(),
            provider_status: 'active', // Placeholder
          },
        })
      }
      subscriptionId = sub.id
    }

    const existing = await tx.donation.findUnique({
      where: {
        payment_account_id_provider_payment_id: {
          payment_account_id: paymentAccountId,
          provider_payment_id: providerPaymentId,
        },
      },
    })

    if (existing) {
      if (existing.status === 'PAID' && status === 'FAILED') {
        // Enforce stale-event guard: preserve PAID, ignore stale failure
        return existing
      }
      if (existing.status === 'FAILED' && status === 'PAID') {
        // Update status to PAID
        return tx.donation.update({
          where: { id: existing.id },
          data: {
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
        // Idempotent no-op
        return existing
      }
      return tx.donation.update({
        where: { id: existing.id },
        data: {
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
        payment_account_id: paymentAccountId,
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
}

export async function APPLY_DONATION_REFUND({
  paymentAccountId,
  providerPaymentId,
  fallbackPaymentId,
  refundedMinor,
}: {
  paymentAccountId: string
  providerPaymentId: string
  fallbackPaymentId?: string
  refundedMinor: number
}) {
  return await db.$transaction(async (tx) => {
    let existing = await tx.donation.findUnique({
      where: {
        payment_account_id_provider_payment_id: {
          payment_account_id: paymentAccountId,
          provider_payment_id: providerPaymentId,
        },
      },
    })

    if (!existing && fallbackPaymentId) {
      existing = await tx.donation.findUnique({
        where: {
          payment_account_id_provider_payment_id: {
            payment_account_id: paymentAccountId,
            provider_payment_id: fallbackPaymentId,
          },
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
    const isFullyRefunded = newRefunded >= existing.amount_minor

    return tx.donation.update({
      where: { id: existing.id },
      data: {
        refunded_minor: newRefunded,
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
