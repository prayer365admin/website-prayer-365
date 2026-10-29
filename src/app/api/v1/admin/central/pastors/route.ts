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
    const q = parseListQuery(req.nextUrl.searchParams, {
      allowOrderBy: ['name', 'introduction', 'staff_account', 'churches'],
      defaults: ['name'],
    })
    const data = await listPastors({
      page: q.page,
      limit: q.limit,
      order_direction: q.order_direction,
      order_by: q.order_by as 'name' | 'introduction' | 'staff_account' | 'churches',
      search: q.search,
      assignment: req.nextUrl.searchParams.get('assignment') as
        'assigned' | 'unassigned' | undefined,
      staff_assignment: req.nextUrl.searchParams.get('staff_assignment') as
        'assigned' | 'unassigned' | undefined,
      church_id: req.nextUrl.searchParams.get('church_id') ?? undefined,
      user_id: req.nextUrl.searchParams.get('user_id') ?? undefined,
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
