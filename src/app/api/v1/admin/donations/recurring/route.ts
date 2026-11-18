import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { list, httpError } from '@/utils/response'
import { parseListQuery } from '@/utils/pagination'
import { registerPath } from '@/utils/openapi'
import { DonationSubscriptionListQuery, DonationSubscriptionRowSchema } from '@/models/donation'
import { listAllDonationSubscriptions } from '@/controller/donation'

/*
 * GET /api/v1/admin/donations/recurring — every church's recurring plan, the
 * central page's Recurring tab. Central `prayer_donation` read is the only grant
 * that reaches here. Each row names its beneficiary church and reports the
 * plan's frequency (Stripe checkout is monthly-only, so this is always Monthly).
 */

registerPath({
  path: '/admin/donations/recurring',
  method: 'get',
  summary: 'List recurring donations across all churches',
  request: {
    params: [
      { name: 'page', in: 'query' as const, schema: z.coerce.number().int().positive() },
      { name: 'limit', in: 'query' as const, schema: z.coerce.number().int().positive() },
      { name: 'order_by', in: 'query' as const, schema: z.string() },
      { name: 'order_direction', in: 'query' as const, schema: z.string() },
      { name: 'currency', in: 'query' as const, schema: z.string() },
      { name: 'churchId', in: 'query' as const, schema: z.string() },
    ],
  },
  responses: [
    {
      status: 200,
      description: 'Paginated recurring donations across all churches',
      schema: z.object({ result: z.array(DonationSubscriptionRowSchema), total: z.number() }),
    },
    { status: 400, description: 'Invalid order_by or order_direction' },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Church not found or out of scope' },
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
    const q = parseListQuery(req.nextUrl.searchParams, {
      allowOrderBy: ['created_at', 'amount'],
    })
    const currency = req.nextUrl.searchParams.get('currency')
    const churchId = req.nextUrl.searchParams.get('churchId') ?? undefined
    const { result, total } = await listAllDonationSubscriptions({
      churchIds,
      query: {
        page: q.page,
        limit: q.limit,
        order_by: q.order_by as DonationSubscriptionListQuery['order_by'],
        order_direction: q.order_direction,
        currency: currency?.toLowerCase(),
        churchId,
      },
    })
    const res = list(result, total, q.page, q.limit, 'Recurring donations retrieved.')
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  } catch (e) {
    return httpError(e)
  }
}
