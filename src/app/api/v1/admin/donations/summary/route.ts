import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { DateRangeSchema } from '@/models/donation'
import { getDonationSummaryByType } from '@/controller/donation'
import { currentUtcMonth } from '@/utils/donation-summary-defaults'

/*
 * GET /api/v1/admin/donations/summary — the three money cards of the
 * `/dashboard/donations` page: per currency, Total / Church / Prayer, each with
 * gross, refunded, net and a transaction count. No cross-currency sum exists.
 *
 * These numbers always aggregate PAID money by `paid_at` (T-05): the page's
 * status filter narrows the list only, so "Total donations" never mixes received
 * money with failed attempts. `from`/`to` default to the current UTC month, the
 * same bounds the list uses.
 */

const bucketSchema = z.object({
  grossMinor: z.string(),
  refundedMinor: z.string(),
  netMinor: z.string(),
  count: z.number(),
})

registerPath({
  path: '/admin/donations/summary',
  method: 'get',
  summary: 'Per-currency all-church donation summary (total / church / prayer)',
  request: {
    params: [
      { name: 'from', in: 'query' as const, schema: z.string() },
      { name: 'to', in: 'query' as const, schema: z.string() },
      { name: 'churchId', in: 'query' as const, schema: z.string() },
    ],
  },
  responses: [
    {
      status: 200,
      description: 'Per-currency donation summary with three buckets',
      schema: z.object({
        from: z.date(),
        to: z.date(),
        currencies: z.array(
          z.object({
            currency: z.string(),
            total: bucketSchema,
            church: bucketSchema,
            prayer: bucketSchema,
          }),
        ),
      }),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Church not found or out of scope' },
    { status: 422, description: 'Invalid or reversed date range' },
    { status: 503, description: 'Platform beneficiary missing (seed not run)' },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_donation',
      action: 'read',
    })
    const range = validate(DateRangeSchema, Object.fromEntries(req.nextUrl.searchParams))
    const defaults = currentUtcMonth()
    const churchId = req.nextUrl.searchParams.get('churchId') ?? undefined
    const summary = await getDonationSummaryByType({
      churchIds,
      from: range.from ?? defaults.from,
      to: range.to ?? defaults.to,
      churchId,
    })
    const res = ok(summary, 'Donation summary retrieved.')
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  } catch (e) {
    return httpError(e)
  }
}
