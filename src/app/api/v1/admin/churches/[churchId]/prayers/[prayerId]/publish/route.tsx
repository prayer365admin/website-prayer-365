import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { PrayerOutputSchema, PublishInputSchema } from '@/models/prayer'
import { publishPrayer } from '@/controller/prayer'

/*
 * POST /api/v1/admin/churches/:churchId/prayers/:prayerId/publish (Task 25).
 * Precondition: current version approved (D4 resolved — audio optional).
 * Sets published pointer + now, clears schedule, enqueues prayer.publish in one
 * transaction; re-publish is idempotent via withIdempotency.
 * prayer_prayer_publication:update.
 */

const paramsDecls = [
  { name: 'churchId', in: 'path' as const, schema: z.string() },
  { name: 'prayerId', in: 'path' as const, schema: z.string() },
]

registerPath({
  path: '/admin/churches/:churchId/prayers/:prayerId/publish',
  method: 'post',
  summary: 'Publish the current approved prayer version (text-only allowed)',
  request: { params: paramsDecls, body: PublishInputSchema },
  responses: [
    { status: 200, description: 'Published prayer', schema: PrayerOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Prayer not found or out of scope' },
    { status: 409, description: 'Stale / not current / text not approved' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string; prayerId: string }> },
) {
  try {
    const { churchId, prayerId } = await params
    const { session } = await requiredAuth(req)
    const input = validate(PublishInputSchema, await req.json())
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_prayer_publication',
      action: 'update',
    })
    const result = await publishPrayer({
      userId: session.user.user_id,
      churchId,
      churchIds,
      prayerId,
      input,
      idempotencyKey: req.headers.get('idempotency-key') ?? undefined,
      requestId: requestId(),
    })
    return ok(result, 'Prayer published.')
  } catch (e) {
    return httpError(e)
  }
}
