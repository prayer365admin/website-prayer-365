import { NextRequest } from 'next/server'
import { z } from 'zod'
import { putChurchPastors } from '@/controller/pastor'
import { ChurchPastorAssignSchema } from '@/models/pastor'
import { registerPath } from '@/utils/openapi'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, ok, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'

registerPath({
  path: '/admin/central/churches/{churchId}/pastors',
  method: 'put',
  summary: 'Replace a church\u2019s pastor assignments (referenced Pastor rows preserved)',
  request: {
    params: [{ name: 'churchId', in: 'path', schema: z.string() }],
    body: ChurchPastorAssignSchema,
  },
  responses: [
    { status: 200, description: 'Updated assignments', schema: z.object({ churchId: z.string() }) },
  ],
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    const { session } = await requiredAuth(req)
    const actorId = session.user.user_id
    await requiredScope({
      userId: actorId,
      central: true,
      subject: 'prayer_pastor',
      action: 'update',
    })
    const { churchId } = await params
    const body = await req.json().catch(() => ({}))
    const payload = validate(ChurchPastorAssignSchema, body)
    const result = await putChurchPastors({ churchId, payload, actorId, requestId: genRequestId() })
    return ok(result, 'Church pastor assignments updated', 200)
  } catch (e) {
    return httpError(e)
  }
}
