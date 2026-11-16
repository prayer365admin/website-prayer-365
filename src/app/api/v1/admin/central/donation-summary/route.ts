import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { GeneralError } from '@/utils/general-error'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { DonationSummarySchema } from '@/models/donation'
import { getPlatformDonationSummary } from '@/controller/donation'

/*
 * GET /api/v1/admin/central/donation-summary — the platform's own giving for one
 * month (YYYY-MM), per currency gross/refunded/net. Same rule as the parish
 * report: NO cross-currency sum. Guest gifts are the platform's revenue, so the
 * read is central-scoped `prayer_donation`.
 */

registerPath({
  path: '/admin/central/donation-summary',
  method: 'get',
  summary: 'Per-currency monthly platform (guest) donation summary',
  request: {
    params: [{ name: 'month', in: 'query' as const, schema: z.string() }],
  },
  responses: [
    { status: 200, description: 'Per-currency donation summary', schema: DonationSummarySchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 422, description: 'Invalid month format' },
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
    const month = req.nextUrl.searchParams.get('month')
    if (!month) {
      throw new GeneralError({
        code: 422,
        error: 'VALIDATION_ERROR',
        error_code: 'INVALID_MONTH',
        details: "'month' (YYYY-MM) is required.",
      })
    }
    const summary = await getPlatformDonationSummary({ month })
    const res = ok(summary, 'Platform donation summary retrieved.')
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  } catch (e) {
    return httpError(e)
  }
}
