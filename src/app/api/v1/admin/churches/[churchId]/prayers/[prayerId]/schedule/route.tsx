import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { PrayerOutputSchema, ScheduleInputSchema } from '@/models/prayer'
import { schedulePrayer } from '@/controller/prayer'

/*
 * PUT /api/v1/admin/churches/:churchId/prayers/:prayerId/schedule (Task 25).
 * Precondition: current version approved (text-only publishing allowed — audio
 * is optional). Sets scheduled_version_id + scheduled_at (both or null).
 * prayer_prayer_publication:update.
 */

const paramsDecls = [
  { name: 'churchId', in: 'path' as const, schema: z.string() },
  { name: 'prayerId', in: 'path' as const, schema: z.string() },
]

registerPath({
  path: '/admin/churches/:churchId/prayers/:prayerId/schedule',
  method: 'put',
  summary: 'Schedule (or clear) publication of the current version',
  request: { params: paramsDecls, body: ScheduleInputSchema },
  responses: [
    { status: 200, description: 'Scheduled prayer', schema: PrayerOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Prayer not found or out of scope' },
    { status: 409, description: 'Stale / not current / text not approved' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string; prayerId: string }> },
) {
  try {
    const { churchId, prayerId } = await params
    const { session } = await requiredAuth(req)
    const input = validate(ScheduleInputSchema, await req.json())
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_prayer_publication',
      action: 'update',
    })
    const result = await schedulePrayer({
      userId: session.user.user_id,
      churchId,
      churchIds,
      prayerId,
      input,
      requestId: requestId(),
    })
    return ok(result, 'Prayer scheduled.')
  } catch (e) {
    return httpError(e)
  }
}
