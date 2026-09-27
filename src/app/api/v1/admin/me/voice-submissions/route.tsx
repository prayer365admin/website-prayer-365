import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, list, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { GeneralError } from '@/utils/general-error'
import { RESOLVE_OWN_SCOPE } from '@/providers/voice'
import {
  VoiceProfileListItemSchema,
  VoiceProfileListQuerySchema,
  VoiceSubmissionInputSchema,
} from '@/models/voice'
import { createSubmission, listOwnSubmissions } from '@/controller/voice'

/*
 * GET / POST /api/v1/admin/me/voice-submissions (Task 36).
 * prayer_voice_submission OWN. GET lists the caller's own revisions; POST
 * creates a DRAFT (sampleAssetId, consentId, assigned churchId, optional
 * replacesProfileId). No provider call at any point here.
 */

registerPath({
  path: '/admin/me/voice-submissions',
  method: 'get',
  summary: 'List own voice submissions',
  responses: [
    { status: 200, description: 'Own submissions', schema: VoiceProfileListItemSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
  ],
})

registerPath({
  path: '/admin/me/voice-submissions',
  method: 'post',
  summary: 'Create a voice submission draft (own)',
  request: { body: VoiceSubmissionInputSchema },
  responses: [
    { status: 200, description: 'Draft created', schema: VoiceProfileListItemSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed / church not assigned / unlinked pastor' },
    { status: 404, description: 'Resource not found' },
    { status: 422, description: 'Validation error / invalid sample, consent or replaces profile' },
    { status: 409, description: 'Idempotency conflict' },
  ],
})

const ownScope = async (userId: string) => {
  const { anchorChurchId } = await RESOLVE_OWN_SCOPE({ userId })
  if (!anchorChurchId)
    throw new GeneralError({
      code: 403,
      error: 'UNAUTHORIZED',
      error_code: 'NOT_ALLOWED',
      details: 'You are not linked to an assigned pastor church.',
    })
  return requiredScope({
    userId,
    churchId: anchorChurchId,
    subject: 'prayer_voice_submission',
    action: 'read',
  })
}

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const { churchIds } = await ownScope(session.user.user_id)
    const query = validate(
      VoiceProfileListQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams),
    )
    const result = await listOwnSubmissions({
      userId: session.user.user_id,
      churchIds,
      query,
    })
    return list(result.result, result.total, query.page, query.limit, 'Voice submissions.')
  } catch (e) {
    return httpError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const input = validate(VoiceSubmissionInputSchema, await req.json())
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId: input.churchId,
      subject: 'prayer_voice_submission',
      action: 'create',
    })
    const result = await createSubmission({
      userId: session.user.user_id,
      churchIds,
      input,
      idempotencyKey: req.headers.get('idempotency-key') ?? undefined,
      requestId: crypto.randomUUID(),
    })
    return ok(result, 'Voice submission draft created.')
  } catch (e) {
    return httpError(e)
  }
}
