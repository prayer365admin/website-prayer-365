import { NextRequest } from 'next/server'
import { z } from 'zod'
import { unarchiveChurch } from '@/controller/central-church'
import { ChurchVersionSchema } from '@/models/central-church'
import { registerPath } from '@/utils/openapi'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, ok, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'

registerPath({
  path: '/admin/central/churches/{churchId}/unarchive',
  method: 'post',
  summary: 'Unarchive a church back to approved status',
  request: {
    params: [{ name: 'churchId', in: 'path', schema: z.string() }],
    body: ChurchVersionSchema,
  },
  responses: [
    { status: 200, description: 'Unarchived church', schema: z.object({ id: z.string() }) },
  ],
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string }> },
) {
  try {
    const { session } = await requiredAuth(req)
    const actorId = session.user.user_id
    await requiredScope({
      userId: actorId,
      central: true,
      subject: 'prayer_church_lifecycle',
      action: 'update',
    })
    const { churchId } = await params
    const body = await req.json().catch(() => ({}))
    const { version } = validate(ChurchVersionSchema, body)
    const result = await unarchiveChurch({ churchId, version, actorId, requestId: genRequestId() })
    return ok(result, 'Church unarchived', 200)
  } catch (e) {
    return httpError(e)
  }
}
