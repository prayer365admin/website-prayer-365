import { NextRequest } from 'next/server'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MobileLoginRequestSchema, MobileTokenResponseSchema } from '@/models/mobile-auth'
import { mobileLogin } from '@/controller/mobile-auth'

/*
 * POST /api/v1/mobile/auth/login (SPEC §3.1 / D1 / plan 002).
 * NOT behind required-auth — this is the mobile token issuance point.
 * Generic 401 on any credential failure (no account-existence leak).
 */

registerPath({
  path: '/mobile/auth/login',
  method: 'post',
  auth: false,
  summary: 'Mobile login — issue short-lived access + hashed refresh token',
  request: { body: MobileLoginRequestSchema },
  responses: [
    { status: 200, description: 'Token pair + identity', schema: MobileTokenResponseSchema },
    { status: 401, description: 'Invalid credentials (generic)' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function POST(req: NextRequest) {
  try {
    const data = validate(MobileLoginRequestSchema, await req.json())
    const result = await mobileLogin(data)
    return ok(result, 'Logged in.')
  } catch (e) {
    return httpError(e)
  }
}
