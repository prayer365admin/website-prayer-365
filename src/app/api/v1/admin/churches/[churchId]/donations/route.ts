import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { list, httpError } from '@/utils/response'
import { parseListQuery } from '@/utils/pagination'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { DateRangeSchema, DonationRowSchema, DonationListQuery } from '@/models/donation'
import { listDonations } from '@/controller/donation'

/*
 * GET /api/v1/admin/churches/:churchId/donations (SPEC §8.2 / Task 29).
 * Bounded (from/to) paginated transaction summaries. Rows carry
 * amount/currency/date/ref only — donor PII is never returned.
 */

registerPath({
  path: '/admin/churches/:churchId/donations',
  method: 'get',
  summary: 'List church donations (no donor PII)',
  request: {
    params: [{ name: 'churchId', in: 'path', schema: z.string() }],
  },
  responses: [
    {
      status: 200,
      description: 'Paginated donations',
      schema: z.object({ result: z.array(DonationRowSchema), total: z.number() }),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Church not found or out of scope' },
  ],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    const { churchId } = await params
    const { session } = await requiredAuth(req)
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_donation',
      action: 'read',
    })
    const q = parseListQuery(req.nextUrl.searchParams, {
      allowOrderBy: ['paid_at', 'created_at', 'amount'],
    })
    const range = validate(DateRangeSchema, Object.fromEntries(req.nextUrl.searchParams))
    const { result, total } = await listDonations({
      churchId,
      churchIds,
      query: {
        page: q.page,
        limit: q.limit,
        order_by: q.order_by as DonationListQuery['order_by'],
        order_direction: q.order_direction,
        from: range.from,
        to: range.to,
      },
    })
    return list(result, total, q.page, q.limit, 'Donations retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
