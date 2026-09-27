import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError, requestId as newRequestId } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { RequestOutputSchema } from '@/models/request'
import { resolveRequestReadScope, getRequestDetail } from '@/controller/request'

/*
 * GET /api/v1/admin/churches/:churchId/requests/:requestId (SPEC §8.2 /
 * Task 28). Same sensitive rule as the list: private rows additionally need
 * the church-local `prayer_private_request:read` grant. Any out-of-scope or
 * private-to-caller row is 404 (existence hidden). A successful sensitive
 * read records a minimal access-audit line (no message/contact/classification).
 */

registerPath({
  path: '/admin/churches/:churchId/requests/:requestId',
  method: 'get',
  summary: 'Get an authorized sensitive request',
  request: {
    params: [
      { name: 'churchId', in: 'path', schema: z.string() },
      { name: 'requestId', in: 'path', schema: z.string() },
    ],
  },
  responses: [
    {
      status: 200,
      description: 'Authorized request details',
      schema: z.object({
        success: z.boolean(),
        message: z.string(),
        result: RequestOutputSchema,
        request_id: z.string(),
      }),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'Request not found, out of scope, or private to caller' },
  ],
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string; requestId: string }> },
) {
  try {
    const { churchId, requestId } = await params
    const { session } = await requiredAuth(req)
    const { churchIds } = await resolveRequestReadScope({ userId: session.user.user_id, churchId })
    const result = await getRequestDetail({
      userId: session.user.user_id,
      churchId,
      churchIds,
      requestId,
      traceId: newRequestId(),
    })
    return ok(result, 'Request retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
