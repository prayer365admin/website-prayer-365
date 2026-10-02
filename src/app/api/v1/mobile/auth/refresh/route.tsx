import { NextRequest } from 'next/server'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MobileRefreshRequestSchema } from '@/models/mobile-auth'
import { mobileRefresh } from '@/controller/mobile-auth'

/*
 * POST /api/v1/mobile/auth/refresh (SPEC §3.1 / D1 / plan 002).
 * Rotates a single-use refresh token. A REUSED token revokes the whole family.
 */

registerPath({
  path: '/mobile/auth/refresh',
  method: 'post',
  auth: false,
  summary: 'Rotate refresh token — issue a new access + refresh pair',
  request: { body: MobileRefreshRequestSchema },
  responses: [
    { status: 200, description: 'Fresh access + refresh pair' },
    { status: 401, description: 'Invalid, expired, or reused token (family revoked)' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function POST(req: NextRequest) {
  try {
    const data = validate(MobileRefreshRequestSchema, await req.json())
    const result = await mobileRefresh(data)
    return ok(result, 'Token refreshed.')
  } catch (e) {
    return httpError(e)
  }
}
