import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { VoiceApproveInputSchema, VoiceProfileDetailSchema } from '@/models/voice'
import { approveProfile } from '@/controller/voice'

/*
 * POST /api/v1/admin/central/voice-profiles/:voiceId/approve (Task 38).
 * Admin reviewer only, no self-approval. Atomic review update + unique
 * voice-register outbox job in ONE transaction -> 202. Repeated approve is
 * idempotent (no duplicate outbox). Prayer-voice-profile:update.
 */

registerPath({
  path: '/admin/central/voice-profiles/:voiceId/approve',
  method: 'post',
  summary: 'Approve a voice submission and queue registration',
  request: {
    params: [{ name: 'voiceId', in: 'path' as const, schema: z.string().uuid() }],
    body: VoiceApproveInputSchema,
  },
  responses: [
    { status: 202, description: 'Approved and queued', schema: VoiceProfileDetailSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed / self-approval forbidden' },
    { status: 404, description: 'Voice profile not found' },
    { status: 409, description: 'Stale / not submitted / disabled / revoked consent' },
  ],
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ voiceId: string }> }) {
  try {
    const { session } = await requiredAuth(req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_voice_profile',
      action: 'update',
    })
    const { voiceId } = await params
    const input = validate(VoiceApproveInputSchema, await req.json())
    const result = await approveProfile({
      userId: session.user.user_id,
      profileId: voiceId,
      input,
      idempotencyKey: req.headers.get('idempotency-key') ?? undefined,
      requestId: crypto.randomUUID(),
    })
    return ok(result, 'Voice profile approved and queued for registration.', 202)
  } catch (e) {
    return httpError(e)
  }
}
