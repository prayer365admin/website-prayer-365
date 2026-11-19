import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import {
  MobileDeletionAckSchema,
  MobileDeletionRequestSchema,
  MobileMePatchSchema,
  MobileMeSchema,
} from '@/models/mobile'
import { GeneralError } from '@/utils/general-error'
import { getMe, patchMe } from '@/controller/mobile'
import { requestMyDeletion } from '@/controller/mobile-deletion'

/*
 * GET / PATCH / DELETE /api/v1/mobile/me (SPEC §8.4 / Task 40, MB-06).
 * GET returns safe profile. PATCH updates name/locale and/or sets the main
 * church; changing the main church is transactional (exactly one is_main row).
 * Subject-only: the user is always the session user.
 */

registerPath({
  path: '/mobile/me',
  method: 'get',
  summary: 'Current user profile (subject only)',
  responses: [
    { status: 200, description: 'Profile', schema: MobileMeSchema },
    { status: 401, description: 'Not authenticated' },
  ],
})

registerPath({
  path: '/mobile/me',
  method: 'patch',
  summary: 'Update profile / set main church (transactional single is_main)',
  request: { body: MobileMePatchSchema },
  responses: [
    { status: 200, description: 'Updated profile', schema: MobileMeSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'Church not found or not approved' },
    { status: 422, description: 'Validation error' },
  ],
})

registerPath({
  path: '/mobile/me',
  method: 'delete',
  summary:
    'Request account deletion (customers only; 202 = accepted, finalized after the grace window)',
  request: { body: MobileDeletionRequestSchema },
  responses: [
    { status: 202, description: 'Accepted (not erased yet)', schema: MobileDeletionAckSchema },
    { status: 400, description: 'IDEMPOTENCY_KEY_REQUIRED' },
    { status: 401, description: 'Not authenticated / REAUTH_REQUIRED (sign in again first)' },
    { status: 403, description: 'DELETION_NOT_ALLOWED (not a customer account)' },
    { status: 409, description: 'Idempotency key reused with a different request' },
    { status: 422, description: 'Validation error (reason longer than 500 characters)' },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const result = await getMe({ userId: session.user.user_id })
    return ok(result, 'Profile retrieved.')
  } catch (e) {
    return httpError(e)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const data = validate(MobileMePatchSchema, await req.json())
    const result = await patchMe({ userId: session.user.user_id, data })
    return ok(result, 'Profile updated.')
  } catch (e) {
    return httpError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    // The body is optional: no body means no reason. A body that is not JSON is a client bug.
    const raw = await req.text()
    let body: unknown = {}
    if (raw.trim()) {
      try {
        body = JSON.parse(raw)
      } catch {
        throw new GeneralError({
          code: 400,
          error: 'BAD_REQUEST',
          error_code: 'INVALID_JSON',
          details: 'The request body must be valid JSON.',
        })
      }
    }
    const { reason } = validate(MobileDeletionRequestSchema, body)
    const result = await requestMyDeletion({
      userId: session.user.user_id,
      idempotencyKey: req.headers.get('idempotency-key') ?? undefined,
      requestId: requestId(),
      reason,
    })
    return ok(result, 'Account deletion requested.', 202)
  } catch (e) {
    return httpError(e)
  }
}
