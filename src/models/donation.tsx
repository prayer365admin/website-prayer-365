import { GeneralError } from '@/utils/general-error'
import { PLATFORM_DONATION_MAX_MINOR, PLATFORM_DONATION_MIN_MINOR } from '@/config/platform-church'
import { z } from 'zod'

/** W11 "Designate Ministry Purpose": the designation a gift is directed to. */
export const DonationCategorySchema = z.enum(['general', 'pantry', 'organ', 'youth'])

export type DonationCategory = z.infer<typeof DonationCategorySchema>

export const DonationInputSchema = z
  .object({
    amountMinor: z.number().int().positive().max(100_000_000),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((c) => c.toLowerCase()),
    frequency: z.enum(['one_time', 'monthly']),
    /** Rides into Stripe transaction metadata as `category`; omitted → no key. */
    category: DonationCategorySchema.optional(),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
  })
  .strict()

export type DonationInput = z.infer<typeof DonationInputSchema>

export const assertNoRawCardData = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return
  const forbidden = new Set([
    'cardnumber',
    'card_number',
    'pan',
    'cvv',
    'cvc',
    'security_code',
    'card_exp_month',
    'card_exp_year',
    'exp_month',
    'exp_year',
    'expiry',
    'track_data',
    'cardholder_name',
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const check = (obj: any) => {
    if (!obj || typeof obj !== 'object') return
    for (const key of Object.keys(obj)) {
      if (forbidden.has(key.toLowerCase())) {
        throw new GeneralError({
          code: 422,
          error: 'VALIDATION_ERROR',
          error_code: 'RAW_CARD_DATA_FORBIDDEN',
          details:
            'Raw card data is strictly forbidden. Donations must be processed through the provider.',
        })
      }
      check(obj[key])
    }
  }
  check(payload)
}

/*
 * Donation DTOs (SPEC §8.2, F7 / Tasks 29-30). Donor PII is never returned:
 * a donation row exposes amount/currency/date/ref only (ref is the provider
 * payment reference, never a donor identity or provider secret). Money stays
 * in minor units and, crucially, is NEVER summed across currencies — each
 * currency is reported independently.
 */

export const DonationRowSchema = z.object({
  id: z.string(),
  amountMinor: z.string(), // BigInt minor units serialized as string
  currency: z.string(),
  status: z.string(), // PAID | FAILED | REFUNDED | provider-reported state
  paidAt: z.date().nullable(),
  createdAt: z.date().optional(),
  ref: z.string(), // provider payment reference (no donor PII)
})

export type DonationRow = {
  id: string
  amountMinor: string
  currency: string
  status: string
  paidAt: Date | null
  createdAt?: Date
  ref: string
}

export const DonationSubscriptionRowSchema = z.object({
  id: z.string(),
  amountMinor: z.string(),
  currency: z.string(),
  providerStatus: z.string(),
  createdAt: z.date(),
  churchId: z.string(),
  churchName: z.string(),
  /** Stripe checkout is created with `interval: 'month'` only, so every stored plan is monthly. */
  frequency: z.literal('Monthly'),
  /** Receipt URL of the plan's most recent paid charge, or null before the first one. */
  invoiceUrl: z.string().nullable(),
})

export type DonationSubscriptionRow = {
  id: string
  amountMinor: string
  currency: string
  providerStatus: string
  createdAt: Date
  churchId: string
  churchName: string
  frequency: 'Monthly'
  invoiceUrl: string | null
}

/** One calendar month of the all-church ledger, per currency. Money is minor-unit strings. */
export type MonthlySummaryRow = {
  /** `YYYY-MM`, in UTC. */
  month: string
  currency: string
  grossMinor: string
  refundedMinor: string
  netMinor: string
  count: number
}

export const DonationSummaryRowSchema = z.object({
  currency: z.string(),
  grossMinor: z.string(),
  refundedMinor: z.string(),
  netMinor: z.string(),
  /** Rows folded into this currency bucket for the month. */
  count: z.number(),
})

export type DonationSummaryRow = {
  currency: string
  grossMinor: string
  refundedMinor: string
  netMinor: string
  count: number
}

export const DonationSummarySchema = z.object({
  month: z.string(),
  currencies: z.array(DonationSummaryRowSchema),
})

export type DonationSummary = {
  month: string
  currencies: DonationSummaryRow[]
}

/** Bounded date range query params; both optional, validated from <= to. */
export const DateRangeSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.from && val.to && val.from > val.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "'from' must be <= 'to'",
        path: ['from'],
      })
    }
  })

export type DateRange = { from?: Date; to?: Date }

/** Paginated donation list query (page/limit/order_by + optional from/to bounds + optional currency filter). */
export type DonationListQuery = {
  page: number
  limit: number
  order_by: 'paid_at' | 'created_at' | 'amount'
  order_direction: 'asc' | 'desc'
  from?: Date
  to?: Date
  currency?: string
}

/*
 * Admin ledger report (dashboard donations page). The type of a gift is derived
 * from its beneficiary (T-01): a row on the hidden platform church is a PRAYER
 * gift, every other row is a CHURCH gift. `DonationRowSchema` stays untouched so
 * the mobile read contract keeps its "no donor PII" shape.
 */

export const DonationLedgerStatusSchema = z.enum(['PAID', 'FAILED', 'REFUNDED'])

export type DonationLedgerStatus = z.infer<typeof DonationLedgerStatusSchema>

export const DonationTypeSchema = z.enum(['CHURCH', 'PRAYER'])

export type DonationType = z.infer<typeof DonationTypeSchema>

export const AdminDonationRowSchema = DonationRowSchema.extend({
  churchId: z.string(),
  churchName: z.string(),
  type: DonationTypeSchema,
  refundedMinor: z.string(),
  donor: z.object({ name: z.string(), email: z.string() }).nullable(),
  /** Provider-hosted receipt; null on rows synced before the column existed. */
  invoiceUrl: z.string().nullable(),
})

export type AdminDonationRow = DonationRow & {
  churchId: string
  churchName: string
  type: DonationType
  refundedMinor: string
  donor: { name: string; email: string } | null
  invoiceUrl: string | null
}

export type DonationBucket = {
  grossMinor: string
  refundedMinor: string
  netMinor: string
  count: number
}

export type AdminDonationSummary = {
  from: Date
  to: Date
  currencies: Array<{
    currency: string
    total: DonationBucket
    church: DonationBucket
    prayer: DonationBucket
  }>
}

/** Admin list query: the church-scoped query plus an optional church filter and ledger status. */
export type AdminDonationListQuery = DonationListQuery & {
  churchId?: string
  status?: DonationLedgerStatus
  /** Derived, never stored: `PRAYER` = the platform beneficiary, `CHURCH` = every other church. */
  type?: DonationType
}

/** Paginated recurring-subscription list query (read-only). */
export type DonationSubscriptionListQuery = {
  page: number
  limit: number
  order_by: 'created_at' | 'amount' | 'provider_status'
  order_direction: 'asc' | 'desc'
  currency?: string
}

/** The signed-in customer's own active monthly gift (website Home stewardship card). */
export type MyActiveGift = {
  amountMinor: number
  currency: string
  churchId: string
  churchName: string
}

/*
 * Website donation attempts (WB-40/42). A giver's attempt is identified by the
 * checkout session Stripe redirects back with; the outcome is read from our own
 * records, never from the URL. `confirmed` requires a PAID row.
 */

export const DonationStatusQuerySchema = z
  .object({
    sessionId: z.string().trim().min(1),
    churchId: z.string().trim().min(1),
    amountMinor: z.coerce.number().int().positive().max(100_000_000),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((c) => c.toLowerCase()),
    frequency: z.enum(['one_time', 'monthly']),
  })
  .strict()

export type DonationStatusQuery = z.infer<typeof DonationStatusQuerySchema>

export const DonationStatusSchema = z.object({
  state: z.enum(['confirmed', 'pending', 'failed']),
  churchId: z.string(),
  churchSlug: z.string().nullable().optional(),
  churchName: z.string(),
  amountMinor: z.number().int(),
  currency: z.string(),
  frequency: z.enum(['one_time', 'monthly']),
  paidAt: z.date().nullable(),
  /** Stripe reported the session; the donation row has not landed yet. */
  receiptSeen: z.boolean(),
})

export type DonationStatus = z.infer<typeof DonationStatusSchema>

/**
 * POST /api/v1/site/donations body: the beneficiary parish travels as a field,
 * not as a path segment, so the browser never composes an API URL from data.
 */
export const SiteDonationInitiateSchema = DonationInputSchema.extend({
  churchId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid church id.'),
})

export type SiteDonationInitiate = z.infer<typeof SiteDonationInitiateSchema>

/**
 * POST /api/v1/site/donations/public body: an anonymous gift to Prayer 365 itself.
 *
 * `.strict()` is the security control, not a style choice — the beneficiary is
 * resolved server-side from the seeded platform row, so a body that names a
 * `churchId`, a `successUrl`/`cancelUrl` (open redirect / spoofed return) or a
 * monthly frequency is a 422 instead of being silently ignored.
 */
export const PublicDonationInitiateSchema = z
  .object({
    amountMinor: z.number().int().min(PLATFORM_DONATION_MIN_MINOR).max(PLATFORM_DONATION_MAX_MINOR),
    currency: z.literal('eur'),
    frequency: z.literal('one_time'),
  })
  .strict()

export type PublicDonationInitiate = z.infer<typeof PublicDonationInitiateSchema>

/** GET /api/v1/site/donations/public/status query: one provider checkout session id. */
export const PublicDonationStatusQuerySchema = z
  .object({
    sessionId: z
      .string()
      .trim()
      .regex(/^cs_[A-Za-z0-9_]+$/),
  })
  .strict()

export type PublicDonationStatusQuery = z.infer<typeof PublicDonationStatusQuerySchema>

/** What the public thank-you page reads: the outcome only, never donor identity. */
export type PublicDonationStatusView = {
  state: 'confirmed' | 'refunded' | 'pending' | 'failed' | 'unknown'
  amountMinor: number | null
  currency: string | null
  paidAt: Date | null
}

/** The same view after JSON: the timestamp travels as an ISO string. */
export type PublicDonationStatusClientView = Omit<PublicDonationStatusView, 'paidAt'> & {
  paidAt: string | null
}

/** POST body for the billing-portal hand-off: an in-app return path, never a host. */
export const BillingPortalRequestSchema = z
  .object({
    returnPath: z
      .string()
      .trim()
      .max(2048)
      .refine((path) => path.startsWith('/donate'), 'Must be an in-app /donate path.')
      .optional(),
  })
  .strict()

export type BillingPortalRequest = z.infer<typeof BillingPortalRequestSchema>

/** What `initiateDonation` returns to the website: a redirect target plus the attempt shape. */
export type DonationInitiateResult = {
  sessionId: string
  url: string
  churchId: string
  amountMinor: number
  currency: string
  frequency: 'one_time' | 'monthly'
}

/** Status a browser can read from the JSON route (dates travel as ISO strings). */
export type DonationStatusView = Pick<
  DonationStatus,
  | 'state'
  | 'churchId'
  | 'churchSlug'
  | 'churchName'
  | 'amountMinor'
  | 'currency'
  | 'frequency'
  | 'receiptSeen'
>

/** One currency's slice of the giver's own paid giving in a calendar year. */
export type MyDonationContribution = {
  currency: string
  totalMinor: number
  count: number
  /** 0-based months (Jan = 0) of the year that carry at least one paid gift. */
  months: number[]
}

/** Website donate screen's right column: the giver's own stewardship, never shared. */
export type MyLatestDonation = {
  id: string
  amountMinor: number
  currency: string
  paidAt: Date | null
  isMonthly: boolean
  churchId: string
  churchName: string
  churchSlug: string
}

export type MyDonationOverview = {
  year: number
  activeGift: MyActiveGift | null
  /** Latest completed transaction across all churches, or null. */
  latestTransaction?: MyLatestDonation | null
  contributions: MyDonationContribution[]
  /** Latest paid gift for the active gift's church, or null. */
  lastPaidAt: Date | null
  /** Derived next monthly charge (last paid + 1 month) — null unless a pledge is active. */
  nextGiftAt: Date | null
}

/**
 * W11 spotlight: the nearest other parish that has a published prayer, so the
 * donate screen shows a real neighbour instead of a fixed story. Null when the
 * beneficiary has no coordinates or no nearby parish has published anything.
 */
export type DonateNeighborSpotlight = {
  churchId: string
  slug: string
  churchName: string
  coverUrl: string | null
  distanceKm: number | null
  prayer: {
    id: string
    title: string
    body: string
    pastorName: string
    churchName: string
  }
}
