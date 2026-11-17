import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { list, httpError } from '@/utils/response'
import { parseListQuery } from '@/utils/pagination'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { DateRangeSchema, DonationRowSchema, DonationListQuery } from '@/models/donation'
import { listPlatformDonations } from '@/controller/donation'

/*
 * GET /api/v1/admin/central/donations — guest giving to Prayer 365 itself.
 *
 * A `/give` gift has no parish: it is attributed to the hidden platform church,
 * which sits outside the parish scope tree on purpose. Central `prayer_donation`
 * read is therefore the only grant that can see it, and that grant returns the
 * platform row's ledger alone — never a parish's. Rows carry
 * amount/currency/date/ref only; donor PII is never returned.
 */

registerPath({
  path: '/admin/central/donations',
  method: 'get',
  summary: 'List platform (guest) donations (no donor PII)',
  request: {
    params: [
      { name: 'page', in: 'query' as const, schema: z.coerce.number().int().positive() },
      { name: 'limit', in: 'query' as const, schema: z.coerce.number().int().positive() },
      { name: 'from', in: 'query' as const, schema: z.string() },
      { name: 'to', in: 'query' as const, schema: z.string() },
      { name: 'currency', in: 'query' as const, schema: z.string() },
    ],
  },
  responses: [
    {
      status: 200,
      description: 'Paginated platform donations',
      schema: z.object({ result: z.array(DonationRowSchema), total: z.number() }),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 503, description: 'Platform beneficiary missing (seed not run)' },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_donation',
      action: 'read',
    })
    const q = parseListQuery(req.nextUrl.searchParams, {
      allowOrderBy: ['paid_at', 'created_at', 'amount'],
    })
    const range = validate(DateRangeSchema, Object.fromEntries(req.nextUrl.searchParams))
    const currency = req.nextUrl.searchParams.get('currency')
    const { result, total } = await listPlatformDonations({
      query: {
        page: q.page,
        limit: q.limit,
        order_by: q.order_by as DonationListQuery['order_by'],
        order_direction: q.order_direction,
        from: range.from,
        to: range.to,
        currency: currency ?? undefined,
      },
    })
    const res = list(result, total, q.page, q.limit, 'Platform donations retrieved.')
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  } catch (e) {
    return httpError(e)
  }
}
