import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { GeneralError } from '@/utils/general-error'
import { VoiceDisableInputSchema, VoiceProfileDetailSchema } from '@/models/voice'
import { disableProfile, getCentralProfile, revokeProfileConsent } from '@/controller/voice'

/*
 * GET /api/v1/admin/central/voice-profiles/:voiceId (Task 37)
 *   -> preview/evidence refs + read-only provider Voice ID; never provider secrets.
 * PATCH /api/v1/admin/central/voice-profiles/:voiceId (Task 38 + F4VO V3/V4)
 *   action=disable (default): DISABLED + no longer any pastor's active voice.
 *   action=revoke_consent: revoke the consent; every profile on it is disabled.
 *   prayer_voice_profile:update.
 */

const idSchema = z.string().uuid()

registerPath({
  path: '/admin/central/voice-profiles/:voiceId',
  method: 'get',
  summary: 'Review a voice profile detail (protected preview)',
  request: { params: [{ name: 'voiceId', in: 'path' as const, schema: idSchema }] },
  responses: [
    { status: 200, description: 'Voice profile detail', schema: VoiceProfileDetailSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Voice profile not found' },
  ],
})

registerPath({
  path: '/admin/central/voice-profiles/:voiceId',
  method: 'patch',
  summary: 'Disable a voice profile or revoke its consent',
  request: {
    params: [{ name: 'voiceId', in: 'path' as const, schema: idSchema }],
    body: VoiceDisableInputSchema,
  },
  responses: [
    { status: 200, description: 'Voice profile updated', schema: VoiceProfileDetailSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Voice profile not found' },
    { status: 409, description: 'Stale version / invalid state / consent already revoked' },
  ],
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ voiceId: string }> }) {
  try {
    const { session } = await requiredAuth(_req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_voice_profile',
      action: 'read',
    })
    const { voiceId } = await params
    const result = await getCentralProfile({ profileId: voiceId })
    if (!result)
      throw new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'Voice profile not found.',
      })
    return ok(result, 'Voice profile.')
  } catch (e) {
    return httpError(e)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ voiceId: string }> },
) {
  try {
    const { session } = await requiredAuth(req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_voice_profile',
      action: 'update',
    })
    const { voiceId } = await params
    const input = validate(VoiceDisableInputSchema, await req.json())
    const args = {
      userId: session.user.user_id,
      profileId: voiceId,
      version: input.version,
      requestId: crypto.randomUUID(),
    }
    if (input.action === 'revoke_consent')
      return ok(await revokeProfileConsent(args), 'Voice consent revoked.')
    return ok(await disableProfile(args), 'Voice profile disabled.')
  } catch (e) {
    return httpError(e)
  }
}
