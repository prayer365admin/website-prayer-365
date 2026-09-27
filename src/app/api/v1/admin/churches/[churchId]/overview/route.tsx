import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { ChurchOverviewSchema } from '@/models/church'
import { getChurchOverview } from '@/controller/church'

/*
 * GET /api/v1/admin/churches/:churchId/overview (SPEC §8.2 / §9.2). Scope
 * filtered aggregates; the recent-request section is omitted entirely when
 * the caller lacks request access (checked inside the controller).
 */

registerPath({
  path: '/admin/churches/:churchId/overview',
  method: 'get',
  summary: 'Church overview aggregates',
  request: { params: [{ name: 'churchId', in: 'path', schema: z.string() }] },
  responses: [
    { status: 200, description: 'Church overview', schema: ChurchOverviewSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Church not found or out of scope' },
  ],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    const { churchId } = await params
    const { session } = await requiredAuth(req)
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_church',
      action: 'read',
    })
    const result = await getChurchOverview({ userId: session.user.user_id, churchId, churchIds })
    return ok(result, 'Church overview retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
