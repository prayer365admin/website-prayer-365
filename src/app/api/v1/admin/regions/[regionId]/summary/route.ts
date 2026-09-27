import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { DateRangeSchema } from '@/models/donation'
import { RegionSummarySchema } from '@/models/analytics'
import { getRegionSummary } from '@/controller/analytics'

/*
 * GET /api/v1/admin/regions/:regionId/summary (SPEC §8.2 / Task 32). Region
 * scope: requiredScope resolves the descendant church set server-side via the
 * org tree. Output is aggregate-only — never private requests, never raw donor
 * rows.
 */

registerPath({
  path: '/admin/regions/:regionId/summary',
  method: 'get',
  summary: 'Regional aggregate summary',
  request: {
    params: [{ name: 'regionId', in: 'path', schema: z.string() }],
  },
  responses: [
    { status: 200, description: 'Regional aggregates', schema: RegionSummarySchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Region not found or out of scope' },
    { status: 422, description: 'Invalid from/to bounds' },
  ],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ regionId: string }> }) {
  try {
    const { regionId } = await params
    const { session } = await requiredAuth(req)
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      regionId,
      subject: 'prayer_analytics',
      action: 'read',
    })
    const range = validate(DateRangeSchema, Object.fromEntries(req.nextUrl.searchParams))
    const result = await getRegionSummary({ regionId, churchIds, from: range.from, to: range.to })
    return ok(result, 'Regional summary retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
