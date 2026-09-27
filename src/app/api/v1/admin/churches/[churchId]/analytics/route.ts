import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { DateRangeSchema } from '@/models/donation'
import { AnalyticsMetricsSchema } from '@/models/analytics'
import { getAnalytics } from '@/controller/analytics'

/*
 * GET /api/v1/admin/churches/:churchId/analytics (SPEC §8.2 / Task 31).
 * Bounded (from/to) metrics derived from SOURCE records (payments, check-ins,
 * events) — no named attendance, no client-event inflation.
 */

registerPath({
  path: '/admin/churches/:churchId/analytics',
  method: 'get',
  summary: 'Church analytics (from source records)',
  request: {
    params: [{ name: 'churchId', in: 'path', schema: z.string() }],
  },
  responses: [
    { status: 200, description: 'Analytics metrics', schema: AnalyticsMetricsSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Church not found or out of scope' },
    { status: 422, description: 'Invalid from/to bounds' },
  ],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    const { churchId } = await params
    const { session } = await requiredAuth(req)
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_analytics',
      action: 'read',
    })
    const range = validate(DateRangeSchema, Object.fromEntries(req.nextUrl.searchParams))
    const result = await getAnalytics({ churchId, churchIds, from: range.from, to: range.to })
    return ok(result, 'Analytics retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
