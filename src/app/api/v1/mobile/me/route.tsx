import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MobileMePatchSchema, MobileMeSchema } from '@/models/mobile'
import { getMe, patchMe } from '@/controller/mobile'

/*
 * GET / PATCH /api/v1/mobile/me (SPEC §8.4 / Task 40).
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
