import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createPastor, listPastors } from '@/controller/pastor'
import { PastorCreateSchema } from '@/models/pastor'
import { registerPath } from '@/utils/openapi'
import { parseListQuery } from '@/utils/pagination'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, list, ok, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'

registerPath({
  path: '/admin/central/pastors',
  method: 'get',
  summary: 'List central pastor profiles',
  responses: [
    { status: 200, description: 'List of pastors', schema: z.array(z.object({ id: z.string() })) },
  ],
})

registerPath({
  path: '/admin/central/pastors',
  method: 'post',
  summary: 'Create a central pastor profile',
  request: { body: PastorCreateSchema },
  responses: [{ status: 201, description: 'Created pastor', schema: z.object({ id: z.string() }) }],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_pastor',
      action: 'read',
    })
    const q = parseListQuery(req.nextUrl.searchParams, { allowOrderBy: ['name'] })
    const data = await listPastors({
      page: q.page,
      limit: q.limit,
      order_direction: q.order_direction,
      search: q.search,
    })
    return list(data.result, data.total, q.page, q.limit, 'Successfully fetched pastors')
  } catch (e) {
    return httpError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const actorId = session.user.user_id
    await requiredScope({
      userId: actorId,
      central: true,
      subject: 'prayer_pastor',
      action: 'create',
    })
    const body = await req.json().catch(() => ({}))
    const payload = validate(PastorCreateSchema, body)
    const result = await createPastor({ payload, actorId, requestId: genRequestId() })
    return ok(result, 'Pastor created', 201)
  } catch (e) {
    return httpError(e)
  }
}
