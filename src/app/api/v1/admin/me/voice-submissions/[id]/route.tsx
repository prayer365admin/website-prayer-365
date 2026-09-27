import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { GeneralError } from '@/utils/general-error'
import { RESOLVE_OWN_SCOPE } from '@/providers/voice'
import { VoiceProfileListItemSchema, VoiceSubmissionPatchSchema } from '@/models/voice'
import { patchSubmission } from '@/controller/voice'

/*
 * PATCH /api/v1/admin/me/voice-submissions/:id (Task 36).
 * Own submission only, DRAFT only. review/provider/registration fields are
 * server-forbidden — the strict schema rejects any extraneous key (422).
 */

registerPath({
  path: '/admin/me/voice-submissions/:id',
  method: 'patch',
  summary: "Edit an own draft's sample/consent fields",
  request: {
    params: [{ name: 'id', in: 'path' as const, schema: z.string().uuid() }],
    body: VoiceSubmissionPatchSchema,
  },
  responses: [
    { status: 200, description: 'Draft updated', schema: VoiceProfileListItemSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed / not own submission / review fields forbidden' },
    { status: 404, description: 'Submission not found' },
    { status: 409, description: 'Stale version / not a draft' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session } = await requiredAuth(req)
    const { id } = await params
    const input = validate(VoiceSubmissionPatchSchema, await req.json())
    const { anchorChurchId } = await RESOLVE_OWN_SCOPE({ userId: session.user.user_id })
    if (!anchorChurchId)
      throw new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'You are not linked to an assigned pastor church.',
      })
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId: anchorChurchId,
      subject: 'prayer_voice_submission',
      action: 'update',
    })
    const result = await patchSubmission({
      userId: session.user.user_id,
      churchIds,
      profileId: id,
      input,
      requestId: crypto.randomUUID(),
    })
    return ok(result, 'Voice submission draft updated.')
  } catch (e) {
    return httpError(e)
  }
}
