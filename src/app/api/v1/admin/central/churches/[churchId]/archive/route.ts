import { NextRequest } from 'next/server'
import { z } from 'zod'
import { archiveChurch } from '@/controller/central-church'
import { ChurchVersionSchema } from '@/models/central-church'
import { registerPath } from '@/utils/openapi'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, ok, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'

registerPath({
  path: '/admin/central/churches/{churchId}/archive',
  method: 'post',
  summary: 'Archive a church (soft, never a hard delete)',
  request: {
    params: [{ name: 'churchId', in: 'path', schema: z.string() }],
    body: ChurchVersionSchema,
  },
  responses: [
    { status: 200, description: 'Archived church', schema: z.object({ id: z.string() }) },
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
    const result = await archiveChurch({ churchId, version, actorId, requestId: genRequestId() })
    return ok(result, 'Church archived', 200)
  } catch (e) {
    return httpError(e)
  }
}
