import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { GeneralError } from '@/utils/general-error'
import { RESOLVE_OWN_SCOPE } from '@/providers/voice'
import { listOwnChurches } from '@/controller/voice'

/*
 * GET /api/v1/admin/me/voice-churches (F4VO S27).
 * Churches where the caller's linked pastor is assigned (church_pastors) — the
 * church context for My Voice. A pastor has no prayer_church:read, so the
 * general church list is empty for them; this is the own-submission scope.
 */

registerPath({
  path: '/admin/me/voice-churches',
  method: 'get',
  summary: "Churches where the caller's pastor profile is assigned",
  responses: [
    {
      status: 200,
      description: 'Assigned churches',
      schema: z.array(z.object({ id: z.string(), name: z.string() })),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not linked to an assigned pastor / not allowed' },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const userId = session.user.user_id
    const { anchorChurchId } = await RESOLVE_OWN_SCOPE({ userId })
    if (!anchorChurchId)
      throw new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'UNLINKED_PASTOR',
        details: 'Your account is not linked to a pastor assigned to a church.',
      })
    await requiredScope({
      userId,
      churchId: anchorChurchId,
      subject: 'prayer_voice_submission',
      action: 'read',
    })
    return ok(await listOwnChurches({ userId }), 'Assigned churches.')
  } catch (e) {
    return httpError(e)
  }
}
