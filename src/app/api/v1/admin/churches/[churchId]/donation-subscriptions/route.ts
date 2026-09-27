import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { list, httpError } from '@/utils/response'
import { parseListQuery } from '@/utils/pagination'
import { registerPath } from '@/utils/openapi'
import { DonationSubscriptionRowSchema, DonationSubscriptionListQuery } from '@/models/donation'
import { listDonationSubscriptions } from '@/controller/donation'

/*
 * GET /api/v1/admin/churches/:churchId/donation-subscriptions (SPEC §8.2 /
 * Task 29). Paginated recurring summaries — read-only, no editing.
 */

registerPath({
  path: '/admin/churches/:churchId/donation-subscriptions',
  method: 'get',
  summary: 'List church donation subscriptions (read-only)',
  request: {
    params: [{ name: 'churchId', in: 'path', schema: z.string() }],
  },
  responses: [
    {
      status: 200,
      description: 'Paginated subscriptions',
      schema: z.object({ result: z.array(DonationSubscriptionRowSchema), total: z.number() }),
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
      allowOrderBy: ['created_at', 'amount', 'provider_status'],
    })
    const { result, total } = await listDonationSubscriptions({
      churchId,
      churchIds,
      query: {
        page: q.page,
        limit: q.limit,
        order_by: q.order_by as DonationSubscriptionListQuery['order_by'],
        order_direction: q.order_direction,
      },
    })
    return list(result, total, q.page, q.limit, 'Donation subscriptions retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
