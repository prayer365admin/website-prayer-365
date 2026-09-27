import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { MobileMyChurchSchema } from '@/models/mobile'
import { listMyChurches } from '@/controller/mobile'

/*
 * GET /api/v1/mobile/me/churches — the user's main/followed church
 * relationships (SPEC §8.4 / Task 40). Subject-only.
 */

registerPath({
  path: '/mobile/me/churches',
  method: 'get',
  summary: 'User church relationships (main/followed)',
  responses: [
    { status: 200, description: 'Church relationships', schema: MobileMyChurchSchema },
    { status: 401, description: 'Not authenticated' },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const result = await listMyChurches({ userId: session.user.user_id })
    return ok(result, 'Your churches retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
