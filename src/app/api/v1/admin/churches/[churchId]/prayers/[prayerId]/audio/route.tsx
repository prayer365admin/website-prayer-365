import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { PrayerAudioEnqueueInputSchema, PrayerAudioOutputSchema } from '@/models/prayer'
import { enqueueAudio } from '@/controller/prayer-audio'

/*
 * POST /api/v1/admin/churches/:churchId/prayers/:prayerId/audio (Task 23).
 * Validates approved text + a provider-ready voice (review APPROVED,
 * registration READY, consent not revoked, same church/pastor), inserts
 * PrayerAudio (QUEUED) + audio.generate outbox transactionally, idempotent via
 * withIdempotency. Durable async → 202.
 */

const paramsDecls = [
  { name: 'churchId', in: 'path' as const, schema: z.string() },
  { name: 'prayerId', in: 'path' as const, schema: z.string() },
]

registerPath({
  path: '/admin/churches/:churchId/prayers/:prayerId/audio',
  method: 'post',
  summary: 'Enqueue audio generation for the approved text',
  request: { params: paramsDecls, body: PrayerAudioEnqueueInputSchema },
  responses: [
    { status: 202, description: 'Audio generation accepted', schema: PrayerAudioOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Prayer not found or out of scope' },
    { status: 409, description: 'Text not approved / voice not ready / consent revoked / stale' },
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
    const input = validate(PrayerAudioEnqueueInputSchema, await req.json())
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_prayer',
      action: 'update',
    })
    const result = await enqueueAudio({
      userId: session.user.user_id,
      churchId,
      churchIds,
      prayerId,
      input,
      idempotencyKey: req.headers.get('idempotency-key') ?? undefined,
      requestId: requestId(),
    })
    return ok(result, 'Audio generation queued.', 202)
  } catch (e) {
    return httpError(e)
  }
}
