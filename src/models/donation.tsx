import { GeneralError } from '@/utils/general-error'
import { z } from 'zod'

export const DonationInputSchema = z
  .object({
    amountMinor: z.number().int().positive().max(100_000_000),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((c) => c.toLowerCase()),
    frequency: z.enum(['one_time', 'monthly']),
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
})

export type DonationSubscriptionRow = {
  id: string
  amountMinor: string
  currency: string
  providerStatus: string
  createdAt: Date
}

export const DonationSummaryRowSchema = z.object({
  currency: z.string(),
  grossMinor: z.string(),
  refundedMinor: z.string(),
  netMinor: z.string(),
})

export type DonationSummaryRow = {
  currency: string
  grossMinor: string
  refundedMinor: string
  netMinor: string
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

/** Paginated recurring-subscription list query (read-only). */
export type DonationSubscriptionListQuery = {
  page: number
  limit: number
  order_by: 'created_at' | 'amount' | 'provider_status'
  order_direction: 'asc' | 'desc'
  currency?: string
}
