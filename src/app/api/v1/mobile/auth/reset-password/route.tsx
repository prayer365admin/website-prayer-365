import { NextRequest } from 'next/server'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { GeneralError } from '@/utils/general-error'
import { MobileResetPasswordRequestSchema } from '@/models/mobile-auth'
import { resetPassword } from '@/controller/auth'

/*
 * POST /api/v1/mobile/auth/reset-password
 * Public mobile reset completion. Reuses resetPassword (validates token,
 * bumps auth_version which invalidates outstanding mobile sessions).
 */

registerPath({
  path: '/mobile/auth/reset-password',
  method: 'post',
  auth: false,
  summary: 'Mobile reset-password — validate token + new password',
  request: { body: MobileResetPasswordRequestSchema },
  responses: [
    { status: 200, description: 'Password reset' },
    { status: 400, description: 'PASSWORD_MISMATCH / INVALID_PASSWORD / INVALID_TOKEN' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function POST(req: NextRequest) {
  try {
    const data = validate(MobileResetPasswordRequestSchema, await req.json())
    if (data.new_password !== data.confirm_password) {
      throw new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'PASSWORD_MISMATCH',
        details: 'Password and confirm password do not match!',
      })
    }
    const result = await resetPassword({ token: data.token, new_password: data.new_password })
    return ok(result, 'Password has been reset successfully! You can now login.')
  } catch (e) {
    return httpError(e)
  }
}
