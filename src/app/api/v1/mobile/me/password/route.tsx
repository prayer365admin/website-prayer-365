import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MobileChangePasswordSchema } from '@/models/mobile'
import { changeMyPassword } from '@/controller/mobile'

/*
 * POST /api/v1/mobile/me/password — change the signed-in user's password.
 * Subject-only. Invalidates every mobile session (auth_version bump): the client must sign in
 * again with the new password.
 */

registerPath({
  path: '/mobile/me/password',
  method: 'post',
  summary: 'Change password (current password required; signs out all devices)',
  request: { body: MobileChangePasswordSchema },
  responses: [
    { status: 200, description: 'Password changed' },
    {
      status: 400,
      description:
        'PASSWORD_MISMATCH / INVALID_PASSWORD / INVALID_CURRENT_PASSWORD / EMAIL_NOT_VERIFIED / ACCOUNT_LOCKED',
    },
    { status: 401, description: 'Not authenticated' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function POST(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const data = validate(MobileChangePasswordSchema, await req.json())
    const result = await changeMyPassword({ userId: session.user.user_id, data })
    return ok(result, 'Password changed. Please sign in again.')
  } catch (e) {
    return httpError(e)
  }
}
