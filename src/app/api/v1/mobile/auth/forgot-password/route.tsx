import { NextRequest } from 'next/server'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MobileForgotPasswordRequestSchema } from '@/models/mobile-auth'
import { requestPasswordReset } from '@/controller/auth'

/*
 * POST /api/v1/mobile/auth/forgot-password
 * Public (not behind required-auth) mobile password-recovery start.
 * Reuses requestPasswordReset (soft-success for unknown email — no
 * enumeration) and emits the reset link as a mobile deep link
 * (`prayer-365://reset-password?token=…`). Incremental 429 cooldown
 * (1→3→5→10 min max) lives in the controller.
 */

registerPath({
  path: '/mobile/auth/forgot-password',
  method: 'post',
  auth: false,
  summary: 'Mobile forgot-password — email reset deep link + incremental cooldown',
  request: { body: MobileForgotPasswordRequestSchema },
  responses: [
    { status: 200, description: 'Generic success (email sent if registered)' },
    { status: 400, description: 'INVALID_EMAIL' },
    { status: 422, description: 'Validation error' },
    { status: 429, description: 'RESET_TOO_EARLY — incremental reset cooldown' },
  ],
})

export async function POST(req: NextRequest) {
  try {
    const data = validate(MobileForgotPasswordRequestSchema, await req.json())
    const mobileScheme = process.env.NEXT_PUBLIC_MOBILE_SCHEME ?? 'prayer-365'
    const result = await requestPasswordReset({
      email: data.email,
      baseUrl: `http://${req.headers.get('host') || 'localhost:3000'}`,
      linkPrefix: `${mobileScheme}://`,
    })
    return ok(result, 'If your email is registered, a password reset link has been sent!')
  } catch (e) {
    return httpError(e)
  }
}
