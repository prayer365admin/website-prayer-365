import { NextRequest } from 'next/server'
import { z } from 'zod'
import { updatePastor } from '@/controller/pastor'
import { PastorUpdateSchema } from '@/models/pastor'
import { registerPath } from '@/utils/openapi'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, ok, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'

registerPath({
  path: '/admin/central/pastors/{pastorId}',
  method: 'patch',
  summary: 'Update a central pastor profile (global authority)',
  request: {
    params: [{ name: 'pastorId', in: 'path', schema: z.string() }],
    body: z.object({
      name: z.string().optional(),
      introduction: z.string().nullable().optional(),
      userId: z.string().nullable().optional(),
    }),
  },
  responses: [{ status: 200, description: 'Updated pastor', schema: z.object({ id: z.string() }) }],
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pastorId: string }> },
) {
  try {
    const { session } = await requiredAuth(req)
    const actorId = session.user.user_id
    await requiredScope({
      userId: actorId,
      central: true,
      subject: 'prayer_pastor',
      action: 'update',
    })
    const { pastorId } = await params
    const body = await req.json().catch(() => ({}))
    const payload = validate(PastorUpdateSchema, body)
    const result = await updatePastor({ pastorId, payload, actorId, requestId: genRequestId() })
    return ok(result, 'Pastor updated', 200)
  } catch (e) {
    return httpError(e)
  }
}
