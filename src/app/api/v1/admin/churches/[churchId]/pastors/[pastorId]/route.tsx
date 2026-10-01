import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { ChurchPastorPatchInputSchema, ChurchPastorSummarySchema } from '@/models/pastor'
import { patchChurchPastor } from '@/controller/pastor'

/*
 * PATCH /api/v1/admin/churches/:churchId/pastors/:pastorId (SPEC §8.2 /
 * Task 15). Only church-scoped assignment fields (pastoral_role,
 * image_asset_id) are editable; shared name/introduction stays central-owned.
 * Gated by the church version (409 stale); foreign asset rejected (422).
 */

registerPath({
  path: '/admin/churches/:churchId/pastors/:pastorId',
  method: 'patch',
  summary: 'Update church pastor assignment',
  request: {
    params: [
      { name: 'churchId', in: 'path', schema: z.string() },
      { name: 'pastorId', in: 'path', schema: z.string() },
    ],
    body: ChurchPastorPatchInputSchema,
  },
  responses: [
    { status: 200, description: 'Updated pastor assignment', schema: ChurchPastorSummarySchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Pastor assignment not found or out of scope' },
    { status: 409, description: 'Stale version conflict' },
    { status: 422, description: 'Validation error (incl. foreign/readonly fields)' },
  ],
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string; pastorId: string }> },
) {
  try {
    const { churchId, pastorId } = await params
    const { session } = await requiredAuth(req)
    const input = validate(ChurchPastorPatchInputSchema, await req.json())
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_church_pastor',
      action: 'update',
    })
    const result = await patchChurchPastor({
      userId: session.user.user_id,
      churchId,
      churchIds,
      pastorId,
      input,
      requestId: requestId(),
    })
    return ok(result, 'Church pastor updated.')
  } catch (e) {
    return httpError(e)
  }
}
