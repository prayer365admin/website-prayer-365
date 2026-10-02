import { NextRequest } from 'next/server'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MobileLogoutRequestSchema } from '@/models/mobile-auth'
import { mobileLogout } from '@/controller/mobile-auth'

/*
 * POST /api/v1/mobile/auth/logout (SPEC §3.1 / D1 / plan 002).
 * Revokes the presented refresh token (device session).
 */

registerPath({
  path: '/mobile/auth/logout',
  method: 'post',
  auth: false,
  summary: 'Logout — revoke the device session',
  request: { body: MobileLogoutRequestSchema },
  responses: [
    { status: 200, description: 'Session revoked' },
    { status: 401, description: 'Invalid token' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function POST(req: NextRequest) {
  try {
    const data = validate(MobileLogoutRequestSchema, await req.json())
    await mobileLogout(data)
    return ok(null, 'Logged out.')
  } catch (e) {
    return httpError(e)
  }
}
