import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MobileAnalyticsAckSchema, MobileAnalyticsInputSchema } from '@/models/mobile'
import { recordAnalyticsEvents } from '@/controller/mobile'

/*
 * POST /api/v1/mobile/analytics-events (SPEC §8.4 / Task 43).
 * Allowlisted event types only, bounded batch (max 50), deduped by event_key
 * (unique in DB). No arbitrary payloads or private request text.
 */

registerPath({
  path: '/mobile/analytics-events',
  method: 'post',
  summary: 'Record allowlisted analytics events (bounded batch, deduped)',
  request: { body: MobileAnalyticsInputSchema },
  responses: [
    { status: 200, description: 'Analytics accepted', schema: MobileAnalyticsAckSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 422, description: 'Validation error (event type not allowed / too many)' },
  ],
})

export async function POST(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const input = validate(MobileAnalyticsInputSchema, await req.json())
    const result = await recordAnalyticsEvents({
      userId: session.user.user_id,
      input,
      requestId: requestId(),
    })
    return ok(result, 'Analytics recorded.')
  } catch (e) {
    return httpError(e)
  }
}
