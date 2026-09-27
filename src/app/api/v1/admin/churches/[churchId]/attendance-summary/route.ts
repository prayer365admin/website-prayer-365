import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { DateRangeSchema } from '@/models/donation'
import { AttendanceSummarySchema } from '@/models/analytics'
import { getAttendanceSummary } from '@/controller/analytics'

/*
 * GET /api/v1/admin/churches/:churchId/attendance-summary (SPEC §8.2 /
 * Task 31). Bounded (from/to) attendance counts grouped by local calendar
 * date. NO named records — each entry is { date, count }.
 */

registerPath({
  path: '/admin/churches/:churchId/attendance-summary',
  method: 'get',
  summary: 'Church attendance by local date',
  request: {
    params: [{ name: 'churchId', in: 'path', schema: z.string() }],
  },
  responses: [
    { status: 200, description: 'Attendance by date', schema: AttendanceSummarySchema },
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
      subject: 'prayer_attendance',
      action: 'read',
    })
    const range = validate(DateRangeSchema, Object.fromEntries(req.nextUrl.searchParams))
    const result = await getAttendanceSummary({
      churchId,
      churchIds,
      from: range.from,
      to: range.to,
    })
    return ok(result, 'Attendance summary retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
