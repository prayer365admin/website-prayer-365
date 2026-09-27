import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { GeneralError } from '@/utils/general-error'
import { GET_ASSET } from '@/providers/voice'
import { ConsentOutputSchema, VoiceConsentInputSchema } from '@/models/voice'
import { createVoiceConsent } from '@/controller/voice'

/*
 * POST /api/v1/admin/me/voice-consents (Task 35).
 * prayer_voice_submission:create OWN — derives the pastor subject from the
 * linked user and validates a READY, owned, church-scoped CONSENT_EVIDENCE
 * asset before recording a voice-cloning consent. Idempotent key.
 */

registerPath({
  path: '/admin/me/voice-consents',
  method: 'post',
  summary: 'Record a voice-cloning consent from the evidence asset (own)',
  request: { body: VoiceConsentInputSchema },
  responses: [
    { status: 200, description: 'Consent recorded', schema: ConsentOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed / unlinked pastor' },
    { status: 404, description: 'Evidence asset not found' },
    { status: 422, description: 'Validation error / invalid evidence' },
    { status: 409, description: 'Idempotency conflict' },
  ],
})

export async function POST(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const input = validate(VoiceConsentInputSchema, await req.json())
    const asset = await GET_ASSET({ assetId: input.evidenceAssetId })
    if (!asset)
      throw new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'EVIDENCE_ASSET_NOT_FOUND',
        details: 'Evidence asset not found.',
      })
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId: asset.church_id,
      subject: 'prayer_voice_submission',
      action: 'create',
    })
    const result = await createVoiceConsent({
      userId: session.user.user_id,
      churchIds,
      input,
      idempotencyKey: req.headers.get('idempotency-key') ?? undefined,
      requestId: crypto.randomUUID(),
    })
    return ok(result, 'Voice consent recorded.')
  } catch (e) {
    return httpError(e)
  }
}
