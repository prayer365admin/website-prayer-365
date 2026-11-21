import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { list, httpError } from '@/utils/response'
import { parseListQuery } from '@/utils/pagination'
import { validate } from '@/utils/validate'
import { parseDonationLedgerStatus } from '@/utils/donation-status-param'
import { registerPath } from '@/utils/openapi'
import {
  AdminDonationRowSchema,
  DateRangeSchema,
  DonationLedgerStatusSchema,
  DonationListQuery,
  DonationTypeSchema,
} from '@/models/donation'
import { GeneralError } from '@/utils/general-error'
import { listAllDonations } from '@/controller/donation'

/*
 * GET /api/v1/admin/donations — every donation across every church, including
 * the platform beneficiary's guest giving.
 *
 * Central `prayer_donation` read is the only grant that reaches here: the scope
 * guard resolves the GLOBAL root, so country/diocese/deanery/church admins get
 * 403 NOT_ALLOWED. Rows carry the beneficiary church, the derived
 * CHURCH/PRAYER type and the registered donor's name + email (admin-only DTO,
 * T-08); guest gifts report `donor: null`.
 */

registerPath({
  path: '/admin/donations',
  method: 'get',
  summary: 'List donations across all churches (admin donor details included)',
  request: {
    params: [
      { name: 'page', in: 'query' as const, schema: z.coerce.number().int().positive() },
      { name: 'limit', in: 'query' as const, schema: z.coerce.number().int().positive() },
      { name: 'order_by', in: 'query' as const, schema: z.string() },
      { name: 'order_direction', in: 'query' as const, schema: z.string() },
      { name: 'from', in: 'query' as const, schema: z.string() },
      { name: 'to', in: 'query' as const, schema: z.string() },
      { name: 'currency', in: 'query' as const, schema: z.string() },
      { name: 'status', in: 'query' as const, schema: DonationLedgerStatusSchema },
      { name: 'type', in: 'query' as const, schema: DonationTypeSchema },
      { name: 'churchId', in: 'query' as const, schema: z.string() },
    ],
  },
  responses: [
    {
      status: 200,
      description: 'Paginated donations across all churches',
      schema: z.object({ result: z.array(AdminDonationRowSchema), total: z.number() }),
    },
    { status: 400, description: 'Invalid status filter' },
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
      allowOrderBy: ['paid_at', 'created_at', 'amount'],
    })
    const range = validate(DateRangeSchema, Object.fromEntries(req.nextUrl.searchParams))
    const status = parseDonationLedgerStatus(req.nextUrl.searchParams)
    const currency = req.nextUrl.searchParams.get('currency')
    const churchId = req.nextUrl.searchParams.get('churchId') ?? undefined
    // An unknown `type` is a client bug: 400 instead of silently returning every gift.
    const typeRaw = req.nextUrl.searchParams.get('type')
    const parsedType = typeRaw ? DonationTypeSchema.safeParse(typeRaw) : null
    if (parsedType && !parsedType.success) {
      throw new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'INVALID_TYPE',
        details: `'type' must be one of: ${DonationTypeSchema.options.join(', ')}.`,
      })
    }
    const type = parsedType?.data
    const { result, total } = await listAllDonations({
      churchIds,
      query: {
        page: q.page,
        limit: q.limit,
        order_by: q.order_by as DonationListQuery['order_by'],
        order_direction: q.order_direction,
        from: range.from,
        to: range.to,
        currency: currency ?? undefined,
        status,
        churchId,
        type,
      },
    })
    const res = list(result, total, q.page, q.limit, 'Donations retrieved.')
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  } catch (e) {
    return httpError(e)
  }
}
