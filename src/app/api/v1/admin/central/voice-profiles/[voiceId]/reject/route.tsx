import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { VoiceProfileDetailSchema, VoiceRejectInputSchema } from '@/models/voice'
import { rejectProfile } from '@/controller/voice'

/*
 * POST /api/v1/admin/central/voice-profiles/:voiceId/reject (Task 38).
 * Admin reviewer -> REJECTED with a reason. No provider call; the pastor can
 * create a revised submission. prayer_voice_profile:update.
 */

registerPath({
  path: '/admin/central/voice-profiles/:voiceId/reject',
  method: 'post',
  summary: 'Reject a voice submission with a reason',
  request: {
    params: [{ name: 'voiceId', in: 'path' as const, schema: z.string().uuid() }],
    body: VoiceRejectInputSchema,
  },
  responses: [
    { status: 200, description: 'Voice profile rejected', schema: VoiceProfileDetailSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Voice profile not found' },
    { status: 409, description: 'Stale version' },
    { status: 422, description: 'Reason required' },
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
    const input = validate(VoiceRejectInputSchema, await req.json())
    const result = await rejectProfile({
      userId: session.user.user_id,
      profileId: voiceId,
      input,
      requestId: crypto.randomUUID(),
    })
    return ok(result, 'Voice profile rejected.')
  } catch (e) {
    return httpError(e)
  }
}
