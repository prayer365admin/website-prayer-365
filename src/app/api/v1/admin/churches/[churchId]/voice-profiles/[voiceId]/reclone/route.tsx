import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError, requestId } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { VoiceProfileListItemSchema } from '@/models/voice'
import { recloneVoiceProfile } from '@/controller/voice'

/*
 * POST /api/v1/admin/churches/:churchId/voice-profiles/:voiceId/reclone (F4VO V8).
 * Re-create a voice ElevenLabs no longer has, from the same approved samples.
 * prayer_voice_generation:create on the voice's church: super admin, or that
 * church's admin; pastors are denied. Queues voice.register → 202. Idempotent.
 */

registerPath({
  path: '/admin/churches/:churchId/voice-profiles/:voiceId/reclone',
  method: 'post',
  summary: 'Re-create a voice that went missing at the provider',
  request: {
    params: [
      { name: 'churchId', in: 'path' as const, schema: z.string() },
      { name: 'voiceId', in: 'path' as const, schema: z.string() },
    ],
  },
  responses: [
    { status: 202, description: 'Re-clone queued', schema: VoiceProfileListItemSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed for this church' },
    { status: 404, description: 'Voice profile not found in this church' },
    { status: 409, description: 'Voice is not missing at the provider / disabled / revoked' },
  ],
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string; voiceId: string }> },
) {
  try {
    const { churchId, voiceId } = await params
    const { session } = await requiredAuth(req)
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_voice_generation',
      action: 'create',
    })
    const result = await recloneVoiceProfile({
      userId: session.user.user_id,
      churchId,
      churchIds,
      profileId: voiceId,
      idempotencyKey: req.headers.get('idempotency-key') ?? undefined,
      requestId: requestId(),
    })
    return ok(result, 'Voice re-creation queued.', 202)
  } catch (e) {
    return httpError(e)
  }
}
