import { Prisma } from '@prisma/client'
import { unstable_cache } from 'next/cache'
import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import { STRIPE, isStripeEnabled } from './stripe'
import { logger } from '@/utils/logger'
import { SITE_PUBLIC_TAG } from '@/utils/site-cache-tags'
import { PLATFORM_CHURCH_SLUG } from '@/config/platform-church'
import {
  type AdminDonationListQuery,
  type AdminDonationRow,
  type AdminDonationSummary,
  type DonationBucket,
  DonationListQuery,
  DonationSubscriptionListQuery,
  DonationSubscriptionRow,
  DonationSummary,
  DonationSummaryRow,
  MonthlySummaryRow,
  MyActiveGift,
  MyLatestDonation,
} from '@/models/donation'

/*
 * Donation adapter (Tasks 29-30). Donations are scoped to a church directly
 * via church_id (one platform Stripe account; church attribution mirrored from
 * provider metadata). Every query filters BOTH count and rows by the resolved
 * `churchIds` and NEVER selects donor PII (user_id, subscription owner). Money
 * stays in minor units and every summary is grouped per-currency — there is no
 * cross-currency total.
 */

const donationOrderBy = (q: DonationListQuery): Prisma.DonationOrderByWithRelationInput[] =>
  q.order_by === 'amount'
    ? [{ amount_minor: q.order_direction }, { id: 'asc' }]
    : q.order_by === 'created_at'
      ? [{ created_at: q.order_direction }, { id: 'asc' }]
      : [{ paid_at: q.order_direction }, { created_at: q.order_direction }, { id: 'asc' }]

/**
 * Paginated ledger rows for a church set, bounded by paid_at / created_at (failed
 * fallback). Donor name + email are admin-only (T-08) and only reachable through
 * the admin routes; the mobile DTO stays `DonationRow`.
 *
 * `type` is derived, never stored (T-01): a row on the platform beneficiary is a
 * PRAYER gift, everything else is a CHURCH gift. Church-scoped reads never pass
 * the platform id and are always CHURCH — the all-churches report supplies it.
 */
export const GET_DONATIONS = async ({
  churchIds,
  platformChurchId,
  query,
}: {
  churchIds: Set<string>
  platformChurchId?: string
  query: AdminDonationListQuery
}): Promise<{ result: AdminDonationRow[]; total: number }> => {
  const ids = Array.from(churchIds)
  if (ids.length === 0) return { result: [], total: 0 }
  // The type is derived from the beneficiary (T-01), so it is a church predicate: the platform
  // row IS a prayer gift. Applying it here keeps `total` and pagination about the filtered set.
  const churchFilter: Prisma.DonationWhereInput['church_id'] =
    platformChurchId && query.type === 'PRAYER'
      ? platformChurchId
      : platformChurchId && query.type === 'CHURCH'
        ? { in: ids, not: platformChurchId }
        : { in: ids }
  const where: Prisma.DonationWhereInput = {
    church_id: churchFilter,
    currency: query.currency ? query.currency.toLowerCase() : undefined,
    status: query.status,
    ...(query.from !== undefined || query.to !== undefined
      ? {
          OR: [
            {
              paid_at: {
                gte: query.from ?? undefined,
                lte: query.to ?? undefined,
              },
            },
            {
              paid_at: null,
              created_at: {
                gte: query.from ?? undefined,
                lte: query.to ?? undefined,
              },
            },
          ],
        }
      : {}),
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
        status: true,
        paid_at: true,
        created_at: true,
        refunded_minor: true,
        provider_payment_id: true,
        invoice_url: true,
        church: { select: { id: true, name: true } },
        user: { select: { name: true, email: true } },
      },
    }),
  ])
  return {
    total,
    result: rows.map((r) => ({
      id: r.id,
      amountMinor: r.amount_minor.toString(),
      currency: r.currency,
      status: r.status,
      paidAt: r.paid_at,
      createdAt: r.created_at,
      ref: r.provider_payment_id,
      churchId: r.church.id,
      churchName: r.church.name,
      type: platformChurchId && r.church.id === platformChurchId ? 'PRAYER' : 'CHURCH',
      refundedMinor: r.refunded_minor.toString(),
      donor: r.user ? { name: r.user.name, email: r.user.email } : null,
      invoiceUrl: r.invoice_url,
    })),
  }
}

/**
 * The all-church report (T-03): the platform beneficiary is unioned into the
 * scope explicitly, because its org node is seeded outside the GLOBAL root's
 * descendants, so the scope walk would otherwise drop every Prayer gift.
 */
export const GET_DONATIONS_ALL_CHURCHES = async ({
  churchIds,
  platformChurchId,
  query,
}: {
  churchIds: Set<string>
  platformChurchId: string
  query: AdminDonationListQuery
}): Promise<{ result: AdminDonationRow[]; total: number }> => {
  const ids = Array.from(churchIds)
  if (!ids.includes(platformChurchId)) ids.push(platformChurchId)
  return GET_DONATIONS({ churchIds: new Set(ids), platformChurchId, query })
}

const emptyBucket = (): DonationBucket => ({
  grossMinor: '0',
  refundedMinor: '0',
  netMinor: '0',
  count: 0,
})

/**
 * Three money buckets per currency for the all-church report (T-06): ONE grouped
 * query, bucketed in JS by platform id. Total = every row; Church and Prayer are
 * disjoint. Like the per-church summary, this aggregates PAID money by paid_at
 * (T-05) and never sums across currencies (T-07).
 */
export const GET_DONATION_SUMMARY_BY_TYPE = async ({
  churchIds,
  platformChurchId,
  from,
  to,
}: {
  churchIds: Set<string>
  platformChurchId: string
  from?: Date
  to?: Date
}): Promise<AdminDonationSummary> => {
  const ids = Array.from(churchIds)
  if (!ids.includes(platformChurchId)) ids.push(platformChurchId)
  const grouped = await db.donation.groupBy({
    by: ['church_id', 'currency'],
    where: {
      church_id: { in: ids },
      paid_at: { gte: from ?? undefined, lte: to ?? undefined },
    },
    _sum: { amount_minor: true, refunded_minor: true },
    _count: true,
  })

  const perCurrency = new Map<string, AdminDonationSummary['currencies'][number]>()
  const bucketFor = (currency: string) => {
    let entry = perCurrency.get(currency)
    if (!entry) {
      entry = {
        currency,
        total: emptyBucket(),
        church: emptyBucket(),
        prayer: emptyBucket(),
      }
      perCurrency.set(currency, entry)
    }
    return entry
  }
  const fold = (bucket: DonationBucket, gross: bigint, refunded: bigint, count: number) => {
    const nextGross = BigInt(bucket.grossMinor) + gross
    const nextRefunded = BigInt(bucket.refundedMinor) + refunded
    bucket.grossMinor = nextGross.toString()
    bucket.refundedMinor = nextRefunded.toString()
    bucket.netMinor = (nextGross - nextRefunded).toString()
    bucket.count += count
  }

  for (const g of grouped) {
    const gross = g._sum.amount_minor ?? BigInt(0)
    const refunded = g._sum.refunded_minor ?? BigInt(0)
    const count = g._count ?? 0
    const entry = bucketFor(g.currency)
    fold(entry.total, gross, refunded, count)
    fold(g.church_id === platformChurchId ? entry.prayer : entry.church, gross, refunded, count)
  }

  const currencies = Array.from(perCurrency.values()).sort((a, b) =>
    a.currency.localeCompare(b.currency),
  )
  return {
    from: from ?? new Date(0),
    to: to ?? new Date(8640000000000000),
    currencies,
  }
}

/** Raw shape of the grouped monthly query: money arrives as text, the count as int. */
type RawMonthlySummaryRow = {
  month: string
  currency: string
  gross_minor: string
  refunded_minor: string
  count: number
}

/**
 * One row per (UTC month, currency) for the all-church ledger. A single grouped
 * query (T-06-style): asking the database once per month would issue N
 * round-trips. Money stays minor-unit strings and is NEVER summed across
 * currencies; `net` is derived per currency.
 */
export const GET_DONATION_SUMMARY_MONTHLY = async ({
  churchIds,
  from,
  to,
}: {
  churchIds: Set<string>
  from?: Date
  to?: Date
}): Promise<MonthlySummaryRow[]> => {
  const ids = Array.from(churchIds)
  if (ids.length === 0) return []
  const rows = await db.$queryRaw<RawMonthlySummaryRow[]>`
    SELECT to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month,
           currency::text AS currency,
           coalesce(sum(amount_minor), 0)::text AS gross_minor,
           coalesce(sum(refunded_minor), 0)::text AS refunded_minor,
           count(*)::int AS count
      FROM donations
     WHERE church_id = ANY(${ids}::text[])
       AND paid_at >= ${from ?? new Date(0)}
       AND paid_at <= ${to ?? new Date(8640000000000000)}
     GROUP BY 1, 2
     ORDER BY 1 DESC, 2 ASC
  `
  return rows.map((r) => ({
    month: r.month,
    currency: r.currency.toLowerCase(),
    grossMinor: r.gross_minor,
    refundedMinor: r.refunded_minor,
    netMinor: (BigInt(r.gross_minor) - BigInt(r.refunded_minor)).toString(),
    count: Number(r.count),
  }))
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
    church_id: { in: ids },
    currency: query.currency ? query.currency.toLowerCase() : undefined,
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
        church: { select: { id: true, name: true } },
      },
    }),
  ])
  // The plan's own row has no receipt: borrow the latest paid charge's invoice URL
  // so the recurring detail modal can offer the same copy action. ONE query,
  // DISTINCT ON the subscription, newest charge first.
  const latestInvoices =
    rows.length === 0
      ? []
      : await db.donation.findMany({
          where: {
            subscription_id: { in: rows.map((r) => r.id) },
            invoice_url: { not: null },
          },
          distinct: ['subscription_id'],
          orderBy: [{ paid_at: 'desc' }, { created_at: 'desc' }],
          select: { subscription_id: true, invoice_url: true },
        })
  const invoiceBySubscription = new Map(
    latestInvoices.map((d) => [d.subscription_id as string, d.invoice_url as string]),
  )
  return {
    total,
    result: rows.map((r) => ({
      id: r.id,
      amountMinor: r.amount_minor.toString(),
      currency: r.currency,
      providerStatus: r.provider_status,
      createdAt: r.created_at,
      churchId: r.church.id,
      churchName: r.church.name,
      frequency: 'Monthly',
      invoiceUrl: invoiceBySubscription.get(r.id) ?? null,
    })),
  }
}

/**
 * Calendar month boundary calculation using UTC [start, end) bounds
 * (Decision D6: default to UTC month bounds pending church-local timezone decision).
 */
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
      church_id: { in: ids },
      paid_at: { gte: start, lt: end },
    },
    _sum: { amount_minor: true, refunded_minor: true },
    _count: true,
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
        count: g._count,
      }
    })
    .sort((a, b) => a.currency.localeCompare(b.currency))
  return { month, currencies }
}

export const ENSURE_CHURCH_DONATION_ELIGIBLE = async ({
  churchId,
}: {
  churchId: string
}): Promise<{ churchId: string; churchName: string }> => {
  const church = await db.church.findUnique({
    where: { id: churchId },
    select: { id: true, name: true, status: true },
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

  return {
    churchId: church.id,
    churchName: church.name,
  }
}

/**
 * The hidden platform beneficiary (D-01 / D-15): resolved by slug at runtime, so
 * one artefact serves every environment and a re-seed cannot desync an env-var id.
 * Cached like the public church reads — the row changes never, and a 60s window
 * keeps the anonymous checkout start off the database per request.
 */
const GET_PLATFORM_CHURCH_UNCACHED = async (): Promise<{ id: string; name: string } | null> =>
  db.church.findFirst({
    where: { slug: PLATFORM_CHURCH_SLUG, status: 'APPROVED', is_platform: true },
    select: { id: true, name: true },
  })

export const GET_PLATFORM_CHURCH = unstable_cache(
  GET_PLATFORM_CHURCH_UNCACHED,
  ['site-platform-church'],
  { revalidate: 60, tags: [SITE_PUBLIC_TAG] },
)

/**
 * The ledger row for one provider payment (the Stripe payment intent). The public
 * status endpoint keys on it: `provider_payment_id` is unique, so this is the
 * single gift the giver is asking about. No donor PII is selected.
 */
export const GET_DONATION_BY_PAYMENT_ID = async ({
  providerPaymentId,
}: {
  providerPaymentId: string
}) =>
  db.donation.findUnique({
    where: { provider_payment_id: providerPaymentId },
    select: {
      id: true,
      user_id: true,
      status: true,
      amount_minor: true,
      currency: true,
      paid_at: true,
    },
  })

/**
 * If Stripe is enabled, verifies that the database subscription is still active
 * in Stripe. When a donor cancels via the Billing Portal, Stripe may leave the
 * status 'active' until the period ends while setting canceled_at / cancel_at.
 * From the donor's perspective the pledge is canceled, so we update our DB and
 * clear the active status immediately.
 */
const reconcileActiveSubscription = async (row: {
  id: string
  provider_subscription_id: string
}): Promise<boolean> => {
  if (!isStripeEnabled()) return true
  try {
    const sub = await STRIPE.retrieveSubscription(row.provider_subscription_id)
    const isCanceled =
      sub.status === 'canceled' || Boolean(sub.canceledAt) || sub.status !== 'active'
    if (isCanceled) {
      await db.donationSubscription.update({
        where: { id: row.id },
        data: { provider_status: 'canceled' },
      })
      return false
    }
    return true
  } catch {
    return true
  }
}

/** The user's newest active monthly gift, or null. Subject-only: filtered by the caller's own user_id. */
export const GET_MY_ACTIVE_GIFT = async ({
  userId,
}: {
  userId: string
}): Promise<MyActiveGift | null> => {
  const row = await db.donationSubscription.findFirst({
    where: { user_id: userId, provider_status: 'active' },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      provider_subscription_id: true,
      amount_minor: true,
      currency: true,
      church: { select: { id: true, name: true } },
    },
  })
  if (!row) return null

  const isLive = await reconcileActiveSubscription(row)
  if (!isLive) return null

  return {
    amountMinor: Number(row.amount_minor),
    currency: row.currency.toUpperCase(),
    churchId: row.church.id,
    churchName: row.church.name,
  }
}

/**
 * The provider subscription behind the user's newest active pledge. Subject-only:
 * the where clause carries the caller's own user_id, so one giver can never
 * resolve another's subscription id.
 */
export const GET_MY_ACTIVE_SUBSCRIPTION = async ({
  userId,
}: {
  userId: string
}): Promise<{ providerSubscriptionId: string } | null> => {
  const row = await db.donationSubscription.findFirst({
    where: { user_id: userId, provider_status: 'active' },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    select: { id: true, provider_subscription_id: true },
  })
  if (!row) return null

  const isLive = await reconcileActiveSubscription(row)
  if (!isLive) return null

  return { providerSubscriptionId: row.provider_subscription_id }
}

/** Church label for a donation receipt; does NOT require APPROVED (a paid gift keeps its name). */
export const GET_CHURCH_LABEL = async ({ churchId }: { churchId: string }) => {
  return db.church.findUnique({
    where: { id: churchId },
    select: { id: true, slug: true, name: true },
  })
}

/**
 * The giver's own paid donations in a window. Subject-only: every row is
 * filtered by the caller's own user_id, so no other giver's giving can leak.
 */
export const GET_MY_PAID_DONATIONS = async ({
  userId,
  from,
  to,
}: {
  userId: string
  from: Date
  to: Date
}) => {
  const rows = await db.donation.findMany({
    where: { user_id: userId, status: 'PAID', paid_at: { gte: from, lt: to } },
    select: { currency: true, amount_minor: true, paid_at: true, church_id: true },
    orderBy: [{ paid_at: 'desc' }, { id: 'desc' }],
  })
  return rows.map((row) => ({
    currency: row.currency.toUpperCase(),
    amountMinor: Number(row.amount_minor),
    paidAt: row.paid_at,
    churchId: row.church_id,
  }))
}

/**
 * The user's newest paid donation across all churches.
 * Subject-only: filtered by the caller's own user_id.
 */
export const GET_MY_LATEST_DONATION = async ({
  userId,
}: {
  userId: string
}): Promise<MyLatestDonation | null> => {
  const row = await db.donation.findFirst({
    where: { user_id: userId, status: 'PAID' },
    orderBy: [{ paid_at: 'desc' }, { created_at: 'desc' }, { id: 'desc' }],
    include: {
      church: { select: { id: true, name: true, slug: true } },
    },
  })
  if (!row) return null
  return {
    id: row.id,
    amountMinor: Number(row.amount_minor),
    currency: row.currency.toUpperCase(),
    paidAt: row.paid_at,
    isMonthly: Boolean(row.subscription_id),
    churchId: row.church.id,
    churchName: row.church.name,
    churchSlug: row.church.slug ?? row.church.id,
  }
}

/**
 * The giver's newest donation row for an attempt shape. An attempt is matched by
 * (church, amount, currency, cadence) inside a short window: the Stripe checkout
 * session id is never a payment id, so this is the strongest subject-scoped join
 * available without guessing.
 */
export const GET_MY_DONATION_ATTEMPT = async ({
  userId,
  churchId,
  amountMinor,
  currency,
  frequency,
  since,
}: {
  userId: string
  churchId: string
  amountMinor: number
  currency: string
  frequency: 'one_time' | 'monthly'
  since: Date
}) => {
  const row = await db.donation.findFirst({
    where: {
      user_id: userId,
      church_id: churchId,
      amount_minor: BigInt(amountMinor),
      currency: currency.toLowerCase(),
      // A monthly pledge always carries a subscription; a one-time gift never does.
      subscription_id: frequency === 'monthly' ? { not: null } : null,
      created_at: { gte: since },
    },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    select: { status: true, paid_at: true },
  })
  return row ? { status: row.status, paidAt: row.paid_at } : null
}

/** Durable webhook evidence that Stripe reported the checkout session complete. */
export const GET_CHECKOUT_RECEIPT = async ({ sessionId }: { sessionId: string }) => {
  return db.webhookReceipt.findFirst({
    where: { provider: 'stripe', object_id: sessionId },
    orderBy: [{ received_at: 'desc' }, { id: 'desc' }],
    select: { event_type: true, state: true, received_at: true },
  })
}

/**
 * Unsubscribes any other active subscriptions for this church when a new
 * subscription is initiated or completed. Updates the database records to
 * 'canceled' and cancels the prior subscriptions in Stripe.
 */
export const CANCEL_OTHER_CHURCH_SUBSCRIPTIONS = async ({
  userId,
  churchId,
  currentSubscriptionId,
}: {
  userId: string
  churchId: string
  currentSubscriptionId?: string
}): Promise<string[]> => {
  let currentCreatedAt: Date | undefined
  if (currentSubscriptionId) {
    const current = await db.donationSubscription.findUnique({
      where: { provider_subscription_id: currentSubscriptionId },
      select: { created_at: true },
    })
    currentCreatedAt = current?.created_at
  }

  const prior = await db.donationSubscription.findMany({
    where: {
      user_id: userId,
      church_id: churchId,
      provider_status: 'active',
      ...(currentSubscriptionId
        ? { provider_subscription_id: { not: currentSubscriptionId } }
        : {}),
      ...(currentCreatedAt ? { created_at: { lt: currentCreatedAt } } : {}),
    },
    select: { id: true, provider_subscription_id: true },
  })

  if (prior.length > 0) {
    await db.donationSubscription.updateMany({
      where: { id: { in: prior.map((s) => s.id) } },
      data: { provider_status: 'canceled' },
    })
  }

  const idsToCancel = prior.map((s) => s.provider_subscription_id)

  if (isStripeEnabled() && idsToCancel.length > 0) {
    for (const subId of idsToCancel) {
      await STRIPE.cancelSubscription(subId).catch((err) => {
        logger.warn('failed_to_cancel_prior_subscription_in_stripe', {
          subscription_id: subId,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }
  }

  return idsToCancel
}
