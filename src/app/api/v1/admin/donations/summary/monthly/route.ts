import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { DateRangeSchema } from '@/models/donation'
import { currentUtcMonth } from '@/utils/donation-summary-defaults'
import { getDonationSummaryMonthly } from '@/controller/donation'

/*
 * GET /api/v1/admin/donations/summary/monthly — the central page's Monthly
 * Summary tab: one row per UTC month and currency, with gross, refunded, net and
 * a transaction count. Money is never summed across currencies. `from`/`to`
 * default to the current UTC month, the same window the list uses.
 */

const monthlyRowSchema = z.object({
  month: z.string(),
  currency: z.string(),
  grossMinor: z.string(),
  refundedMinor: z.string(),
  netMinor: z.string(),
  count: z.number(),
})

registerPath({
  path: '/admin/donations/summary/monthly',
  method: 'get',
  summary: 'Monthly donation totals per currency across all churches',
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
      description: 'One row per month and currency',
      schema: z.object({ result: z.array(monthlyRowSchema) }),
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
    const rows = await getDonationSummaryMonthly({
      churchIds,
      from: range.from ?? defaults.from,
      to: range.to ?? defaults.to,
      churchId,
    })
    const res = ok(rows, 'Monthly donation summary retrieved.')
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  } catch (e) {
    return httpError(e)
  }
}
