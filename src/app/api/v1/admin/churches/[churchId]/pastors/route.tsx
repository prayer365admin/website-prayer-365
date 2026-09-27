import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { ChurchPastorSummarySchema } from '@/models/pastor'
import { getChurchPastors } from '@/controller/pastor'

/*
 * GET /api/v1/admin/churches/:churchId/pastors (SPEC §8.2 / Task 15). Returns
 * the church-assigned pastors with their church-scoped role/image.
 */

registerPath({
  path: '/admin/churches/:churchId/pastors',
  method: 'get',
  summary: 'List church-assigned pastors',
  request: { params: [{ name: 'churchId', in: 'path', schema: z.string() }] },
  responses: [
    {
      status: 200,
      description: 'Assigned pastors',
      schema: z.object({
        success: z.boolean(),
        message: z.string(),
        result: z.array(ChurchPastorSummarySchema),
        request_id: z.string(),
      }),
    },
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
      subject: 'prayer_pastor',
      action: 'read',
    })
    const result = await getChurchPastors({ churchIds })
    return ok(result, 'Church pastors retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
