import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { GeneralError } from '@/utils/general-error'
import { RESOLVE_OWN_SCOPE } from '@/providers/voice'
import { VoiceProfileListItemSchema, VoiceSubmitInputSchema } from '@/models/voice'
import { submitSubmission } from '@/controller/voice'

/*
 * POST /api/v1/admin/me/voice-submissions/:id/submit (Task 36).
 * Freezes the sample checksum + consent ref and moves DRAFT -> SUBMITTED
 * (immutable). Idempotent via Idempotency-Key. No provider call.
 */

registerPath({
  path: '/admin/me/voice-submissions/:id/submit',
  method: 'post',
  summary: 'Submit an own draft (freezes sample, immutable)',
  request: {
    params: [{ name: 'id', in: 'path' as const, schema: z.string().uuid() }],
    body: VoiceSubmitInputSchema,
  },
  responses: [
    { status: 200, description: 'Submission submitted', schema: VoiceProfileListItemSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed / not own submission' },
    { status: 404, description: 'Submission not found' },
    { status: 409, description: 'Stale version / not a draft / idempotency conflict' },
    { status: 422, description: 'Validation error / sample not ready' },
  ],
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session } = await requiredAuth(req)
    const { id } = await params
    const input = validate(VoiceSubmitInputSchema, await req.json())
    const { anchorChurchId } = await RESOLVE_OWN_SCOPE({ userId: session.user.user_id })
    if (!anchorChurchId)
      throw new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'You are not linked to an assigned pastor church.',
      })
    await requiredScope({
      userId: session.user.user_id,
      churchId: anchorChurchId,
      subject: 'prayer_voice_submission',
      action: 'update',
    })
    const result = await submitSubmission({
      userId: session.user.user_id,
      profileId: id,
      input,
      idempotencyKey: req.headers.get('idempotency-key') ?? undefined,
      requestId: crypto.randomUUID(),
    })
    return ok(result, 'Voice submission submitted.')
  } catch (e) {
    return httpError(e)
  }
}
