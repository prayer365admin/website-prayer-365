import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { GeneralError } from '@/utils/general-error'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { DonationSummarySchema } from '@/models/donation'
import { getDonationSummary } from '@/controller/donation'

/*
 * GET /api/v1/admin/churches/:churchId/donation-summary (SPEC §8.2 / Task 30).
 * Month (YYYY-MM) -> per-currency gross/refunded/net. NO cross-currency sum.
 */

registerPath({
  path: '/admin/churches/:churchId/donation-summary',
  method: 'get',
  summary: 'Per-currency monthly donation summary',
  request: {
    params: [
      { name: 'churchId', in: 'path', schema: z.string() },
      { name: 'month', in: 'query', schema: z.string() },
    ],
  },
  responses: [
    { status: 200, description: 'Per-currency donation summary', schema: DonationSummarySchema },
    { status: 400, description: 'Missing month' },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Church not found or out of scope' },
    { status: 422, description: 'Invalid month format' },
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
    const month = req.nextUrl.searchParams.get('month')
    if (!month) {
      throw new GeneralError({
        code: 422,
        error: 'VALIDATION_ERROR',
        error_code: 'INVALID_MONTH',
        details: "'month' (YYYY-MM) is required.",
      })
    }
    const summary = await getDonationSummary({ churchId, churchIds, month })
    const res = ok(summary, 'Donation summary retrieved.')
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  } catch (e) {
    return httpError(e)
  }
}
