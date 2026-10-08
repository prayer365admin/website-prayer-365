import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import {
  DonationListQuery,
  DonationRow,
  DonationSubscriptionListQuery,
  DonationSubscriptionRow,
  DonationSummary,
  DonationSummaryRow,
  ResolvedPaymentAccount,
} from '@/models/donation'

/*
 * Donation adapter (Tasks 29-30). Donations are scoped to a church through
 * their PaymentAccount (one payment account per church). Every query filters
 * BOTH count and rows by the resolved `churchIds` and NEVER selects donor PII
 * (user_id, subscription owner). Money stays in minor units and every summary
 * is grouped per-currency — there is no cross-currency total.
 */

const donationOrderBy = (q: DonationListQuery): Prisma.DonationOrderByWithRelationInput[] =>
  q.order_by === 'amount'
    ? [{ amount_minor: q.order_direction }, { id: 'asc' }]
    : q.order_by === 'created_at'
      ? [{ created_at: q.order_direction }, { id: 'asc' }]
      : [{ paid_at: q.order_direction }, { id: 'asc' }]

/** Paginated donation rows for a church, bounded by paid_at, no donor PII. */
export const GET_DONATIONS = async ({
  churchIds,
  query,
}: {
  churchIds: Set<string>
  query: DonationListQuery
}): Promise<{ result: DonationRow[]; total: number }> => {
  const ids = Array.from(churchIds)
  if (ids.length === 0) return { result: [], total: 0 }
  const where: Prisma.DonationWhereInput = {
    payment_account: { church_id: { in: ids } },
    paid_at: { gte: query.from ?? undefined, lte: query.to ?? undefined },
  }
  const orderBy = donationOrderBy(query)
  const [total, rows] = await db.$transaction([
    db.donation.count({ where }),
    db.donation.findMany({
      where,
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      orderBy,
      select: {
        id: true,
        amount_minor: true,
        currency: true,
        paid_at: true,
        provider_payment_id: true,
      },
    }),
  ])
  return {
    total,
    result: rows.map((r) => ({
      id: r.id,
      amountMinor: r.amount_minor.toString(),
      currency: r.currency,
      paidAt: r.paid_at,
      ref: r.provider_payment_id,
    })),
  }
}

const subscriptionOrderBy = (
  q: DonationSubscriptionListQuery,
): Prisma.DonationSubscriptionOrderByWithRelationInput[] =>
  q.order_by === 'amount'
    ? [{ amount_minor: q.order_direction }, { id: 'asc' }]
    : q.order_by === 'provider_status'
      ? [{ provider_status: q.order_direction }, { id: 'asc' }]
      : [{ created_at: q.order_direction }, { id: 'asc' }]

/** Paginated recurring subscriptions for a church. Read-only. */
export const GET_DONATION_SUBSCRIPTIONS = async ({
  churchIds,
  query,
}: {
  churchIds: Set<string>
  query: DonationSubscriptionListQuery
}): Promise<{ result: DonationSubscriptionRow[]; total: number }> => {
  const ids = Array.from(churchIds)
  if (ids.length === 0) return { result: [], total: 0 }
  const where: Prisma.DonationSubscriptionWhereInput = {
    payment_account: { church_id: { in: ids } },
  }
  const orderBy = subscriptionOrderBy(query)
  const [total, rows] = await db.$transaction([
    db.donationSubscription.count({ where }),
    db.donationSubscription.findMany({
      where,
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      orderBy,
      select: {
        id: true,
        amount_minor: true,
        currency: true,
        provider_status: true,
        created_at: true,
      },
    }),
  ])
  return {
    total,
    result: rows.map((r) => ({
      id: r.id,
      amountMinor: r.amount_minor.toString(),
      currency: r.currency,
      providerStatus: r.provider_status,
      createdAt: r.created_at,
    })),
  }
}

const monthBounds = (month: string): { start: Date; end: Date } => {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'INVALID_MONTH',
      details: `'${month}' is not a valid YYYY-MM month.`,
    })
  }
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) }
}

/**
 * Per-currency monthly totals: gross paid, refunded, and net. Each currency is
 * a separate aggregate; NO cross-currency sum is ever produced.
 */
export const GET_DONATION_SUMMARY = async ({
  churchIds,
  month,
}: {
  churchIds: Set<string>
  month: string
}): Promise<DonationSummary> => {
  const ids = Array.from(churchIds)
  const { start, end } = monthBounds(month)
  if (ids.length === 0) return { month, currencies: [] }
  const grouped = await db.donation.groupBy({
    by: ['currency'],
    where: {
      payment_account: { church_id: { in: ids } },
      paid_at: { gte: start, lt: end },
    },
    _sum: { amount_minor: true, refunded_minor: true },
  })
  const currencies: DonationSummaryRow[] = grouped
    .map((g) => {
      const gross = g._sum.amount_minor ?? BigInt(0)
      const refunded = g._sum.refunded_minor ?? BigInt(0)
      return {
        currency: g.currency,
        grossMinor: gross.toString(),
        refundedMinor: refunded.toString(),
        netMinor: (gross - refunded).toString(),
      }
    })
    .sort((a, b) => a.currency.localeCompare(b.currency))
  return { month, currencies }
}

export const RESOLVE_CHURCH_PAYMENT_ACCOUNT = async ({
  churchId,
}: {
  churchId: string
}): Promise<ResolvedPaymentAccount> => {
  const church = await db.church.findUnique({
    where: { id: churchId },
    include: { paymentAccount: true },
  })

  if (!church) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'CHURCH_NOT_FOUND',
      details: 'Church not found.',
    })
  }

  if (church.status !== 'APPROVED') {
    throw new GeneralError({
      code: 400,
      error: 'PAYMENT_ERROR',
      error_code: 'CHURCH_NOT_ELIGIBLE',
      details: `Church is not eligible to receive donations (status: ${church.status}).`,
    })
  }

  if (!church.paymentAccount) {
    throw new GeneralError({
      code: 400,
      error: 'PAYMENT_ERROR',
      error_code: 'PAYMENT_ACCOUNT_NOT_CONFIGURED',
      details: 'Church does not have a payment account configured.',
    })
  }

  if (church.paymentAccount.status !== 'ACTIVE') {
    throw new GeneralError({
      code: 400,
      error: 'PAYMENT_ERROR',
      error_code: 'PAYMENT_ACCOUNT_NOT_VERIFIED',
      details: `Church payment account is not verified (status: ${church.paymentAccount.status}).`,
    })
  }

  return {
    churchId: church.id,
    churchName: church.name,
    paymentAccountId: church.paymentAccount.id,
    provider: church.paymentAccount.provider,
    providerAccountId: church.paymentAccount.provider_account_id,
    status: church.paymentAccount.status,
  }
}
