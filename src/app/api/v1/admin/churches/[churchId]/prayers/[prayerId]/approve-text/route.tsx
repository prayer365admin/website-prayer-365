import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { PrayerActionInputSchema, PrayerVersionOutputSchema } from '@/models/prayer'
import { approveText } from '@/controller/prayer'

/*
 * POST /api/v1/admin/churches/:churchId/prayers/:prayerId/approve-text (Task 22).
 * A reviewer (prayer_prayer_review:update) marks the current immutable snapshot
 * approved. Must be the current snapshot (wrong snapshot → 409).
 */

const paramsDecls = [
  { name: 'churchId', in: 'path' as const, schema: z.string() },
  { name: 'prayerId', in: 'path' as const, schema: z.string() },
]

registerPath({
  path: '/admin/churches/:churchId/prayers/:prayerId/approve-text',
  method: 'post',
  summary: 'Approve the current prayer text snapshot',
  request: { params: paramsDecls, body: PrayerActionInputSchema },
  responses: [
    { status: 200, description: 'Approved version', schema: PrayerVersionOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not a reviewer' },
    { status: 404, description: 'Prayer not found or out of scope' },
    { status: 409, description: 'Stale version or not current snapshot' },
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
    const input = validate(PrayerActionInputSchema, await req.json())
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_prayer_review',
      action: 'update',
    })
    const result = await approveText({
      userId: session.user.user_id,
      churchId,
      churchIds,
      prayerId,
      input,
      requestId: requestId(),
    })
    return ok(result, 'Prayer text approved.')
  } catch (e) {
    return httpError(e)
  }
}
