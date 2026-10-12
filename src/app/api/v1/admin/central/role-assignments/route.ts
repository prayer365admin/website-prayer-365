import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createRoleAssignment, listRoleAssignments } from '@/controller/role-assignment'
import { RoleAssignmentCreateSchema } from '@/models/role-assignment'
import { registerPath } from '@/utils/openapi'
import { parseListQuery } from '@/utils/pagination'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, list, ok, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'

registerPath({
  path: '/admin/central/role-assignments',
  method: 'get',
  summary: 'List active role assignments',
  request: {
    params: [
      { name: 'page', in: 'query', schema: z.coerce.number().int().positive().optional() },
      {
        name: 'limit',
        in: 'query',
        schema: z.coerce.number().int().positive().max(100).optional(),
      },
      { name: 'userId', in: 'query', schema: z.string().optional() },
      { name: 'orgNodeId', in: 'query', schema: z.string().optional() },
    ],
  },
  responses: [
    {
      status: 200,
      description: 'List of active role assignments',
      schema: z.array(z.object({ id: z.string() })),
    },
  ],
})

registerPath({
  path: '/admin/central/role-assignments',
  method: 'post',
  summary: 'Create a scoped role assignment (no privilege escalation)',
  request: { body: RoleAssignmentCreateSchema },
  responses: [
    { status: 201, description: 'Created assignment', schema: z.object({ id: z.string() }) },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_role_assignment',
      action: 'read',
    })
    const q = parseListQuery(req.nextUrl.searchParams, { allowOrderBy: ['created_at'] })
    const params = req.nextUrl.searchParams
    const data = await listRoleAssignments({
      page: q.page,
      limit: q.limit,
      order_direction: q.order_direction,
      userId: params.get('userId') || undefined,
      orgNodeId: params.get('orgNodeId') || undefined,
    })
    return list(data.result, data.total, q.page, q.limit, 'Successfully fetched role assignments')
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
      subject: 'prayer_role_assignment',
      action: 'create',
    })
    const body = await req.json().catch(() => ({}))
    const payload = validate(RoleAssignmentCreateSchema, body)
    const result = await createRoleAssignment({ payload, actorId, requestId: genRequestId() })
    return ok(result, 'Role assignment created', 201)
  } catch (e) {
    return httpError(e)
  }
}
