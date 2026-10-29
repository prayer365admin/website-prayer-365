import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { PrayerActionInputSchema, PrayerAudioOutputSchema } from '@/models/prayer'
import { approveAudio } from '@/controller/prayer-audio'
import { revalidateTag } from 'next/cache'
import { SITE_PUBLIC_TAG } from '@/utils/site-cache-tags'

/*
 * POST /api/v1/admin/churches/:churchId/prayers/:prayerId/audio/:audioId/approve
 * (Task 24). Audio reviewer (prayer_prayer_review:update); same snapshot + READY
 * audio → approved + selected_audio_id on the version.
 */

const paramsDecls = [
  { name: 'churchId', in: 'path' as const, schema: z.string() },
  { name: 'prayerId', in: 'path' as const, schema: z.string() },
  { name: 'audioId', in: 'path' as const, schema: z.string() },
]

registerPath({
  path: '/admin/churches/:churchId/prayers/:prayerId/audio/:audioId/approve',
  method: 'post',
  summary: 'Approve generated audio and select it on the version',
  request: { params: paramsDecls, body: PrayerActionInputSchema },
  responses: [
    { status: 200, description: 'Approved audio', schema: PrayerAudioOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not a reviewer' },
    { status: 404, description: 'Audio not found or out of scope' },
    { status: 409, description: 'Stale version / wrong snapshot / audio not ready' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string; prayerId: string; audioId: string }> },
) {
  try {
    const { churchId, prayerId, audioId } = await params
    const { session } = await requiredAuth(req)
    const input = validate(PrayerActionInputSchema, await req.json())
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_prayer_review',
      action: 'update',
    })
    const result = await approveAudio({
      userId: session.user.user_id,
      churchId,
      churchIds,
      prayerId,
      audioId,
      input,
      requestId: requestId(),
    })
    // A newly approved take becomes the playable prayer on the website.
    revalidateTag(SITE_PUBLIC_TAG, { expire: 0 })
    return ok(result, 'Prayer audio approved.')
  } catch (e) {
    return httpError(e)
  }
}
