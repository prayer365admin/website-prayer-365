import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { ChurchProfileInputSchema, ChurchProfileOutputSchema } from '@/models/church'
import { getChurchProfile, patchChurchProfile } from '@/controller/church'

/*
 * GET/PATCH /api/v1/admin/churches/:churchId/profile (SPEC §8.2 / Task 13).
 * The zod schema is strict: server-owned fields (status, approved_by,
 * approved_at) are rejected with 422. Owned languages, coordinates
 * both-or-null, and cover asset ownership are validated in the controller.
 */

const churchIdParam = { name: 'churchId', in: 'path' as const, schema: z.string() }

registerPath({
  path: '/admin/churches/:churchId/profile',
  method: 'get',
  summary: 'Get editable church profile',
  request: { params: [churchIdParam] },
  responses: [
    { status: 200, description: 'Editable profile', schema: ChurchProfileOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Church not found or out of scope' },
  ],
})

registerPath({
  path: '/admin/churches/:churchId/profile',
  method: 'patch',
  summary: 'Update editable church profile',
  request: { params: [churchIdParam], body: ChurchProfileInputSchema },
  responses: [
    { status: 200, description: 'Updated profile', schema: ChurchProfileOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Church not found or out of scope' },
    { status: 409, description: 'Stale version conflict' },
    { status: 422, description: 'Validation error (incl. server-owned / foreign fields)' },
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
    const result = await getChurchProfile({ churchId, churchIds })
    return ok(result, 'Church profile retrieved.')
  } catch (e) {
    return httpError(e)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string }> },
) {
  try {
    const { churchId } = await params
    const { session } = await requiredAuth(req)
    const input = validate(ChurchProfileInputSchema, await req.json())
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_church',
      action: 'update',
    })
    const result = await patchChurchProfile({
      userId: session.user.user_id,
      churchId,
      churchIds,
      input,
      requestId: requestId(),
    })
    return ok(result, 'Church profile updated.')
  } catch (e) {
    return httpError(e)
  }
}
