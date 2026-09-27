import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { MobileHomeSchema } from '@/models/mobile'
import { getHome } from '@/controller/mobile'

/*
 * GET /api/v1/mobile/home — selected/followed church content and shortcuts
 * (SPEC §8.4 / Task 40). Subject-only (session user); anything derived from
 * the user's own relationships on APPROVED churches.
 */

registerPath({
  path: '/mobile/home',
  method: 'get',
  summary: 'User home: main/followed church content and shortcuts',
  responses: [
    { status: 200, description: 'Home payload', schema: MobileHomeSchema },
    { status: 401, description: 'Not authenticated' },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const result = await getHome({ userId: session.user.user_id })
    return ok(result, 'Home retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
