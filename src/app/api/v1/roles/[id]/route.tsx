import { GET_ROLE_BY_ID } from '@/providers/role'
import { deleteRole, updateRole } from '@/controller/role'
import { RolePayloadUpdateSchema } from '@/models/role'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { GeneralError } from '@/utils/general-error'
import requiredAuth from '@/utils/required-auth'
import { z } from 'zod'
import { NextRequest } from 'next/server'

type Params = Promise<{ id: string }>
export async function GET(req: NextRequest, segmentData: { params: Params }) {
  const params = await segmentData.params
  const id = params.id

  try {
    const { permission, session } = await requiredAuth(req)

    // Every account may read its own role: the dashboard derives its controls from it.
    if (id !== session.user.role?.id && !permission.readAny('prayer_role').granted) {
      return httpError(
        new GeneralError({
          code: 403,
          error: 'UNAUTHORIZED',
          error_code: 'NOT_ALLOWED',
          details: 'This account is not allowed for this action.',
        }),
      )
    }

    const result = await GET_ROLE_BY_ID({ role_id: id })
    if (!result) {
      return httpError(
        new GeneralError({
          code: 404,
          error: 'NOT_FOUND',
          error_code: 'ROLE_NOT_FOUND',
          details: 'Role not found.',
        }),
      )
    }

    return ok(result, `Successfully retrieve data with id ${id}!`)
  } catch (error) {
    return httpError(error)
  }
}

// Role editing is enabled again (plan 023): SYSTEM roles keep their name and the
// super-admin role is immutable — see controller/role.tsx for the guards.
export async function PUT(req: NextRequest, segmentData: { params: Params }) {
  const params = await segmentData.params
  try {
    const { session, permission } = await requiredAuth(req)

    if (!permission.updateAny('user_management_role').granted) {
      return httpError(
        new GeneralError({
          code: 403,
          error: 'UNAUTHORIZED',
          error_code: 'NOT_ALLOWED',
          details: 'This account is not allowed for this action.',
        }),
      )
    }

    const payload = validate(RolePayloadUpdateSchema, await req.json().catch(() => ({})))
    const result = await updateRole({
      role_id: params.id,
      payload,
      actorId: session.user.user_id,
      requestId: requestId(),
    })
    return ok(result, 'Role updated.')
  } catch (error) {
    return httpError(error)
  }
}

export async function DELETE(req: NextRequest, segmentData: { params: Params }) {
  const params = await segmentData.params
  try {
    const { session, permission } = await requiredAuth(req)

    if (!permission.deleteAny('user_management_role').granted) {
      return httpError(
        new GeneralError({
          code: 403,
          error: 'UNAUTHORIZED',
          error_code: 'NOT_ALLOWED',
          details: 'This account is not allowed for this action.',
        }),
      )
    }

    const result = await deleteRole({
      role_id: params.id,
      actorId: session.user.user_id,
      requestId: requestId(),
    })
    return ok(result, 'Role deleted.')
  } catch (error) {
    return httpError(error)
  }
}

registerPath({
  path: '/roles/{id}',
  method: 'get',
  summary: 'Role detail (central prayer_role read)',
  request: { params: [{ name: 'id', in: 'path', schema: z.string() }] },
  responses: [
    {
      status: 200,
      description: 'Role detail',
      schema: z.object({
        success: z.literal(true),
        message: z.string(),
        result: z.object({ id: z.string(), name: z.string() }),
        request_id: z.string(),
      }),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Forbidden' },
    { status: 404, description: 'Role not found' },
  ],
})

registerPath({
  path: '/roles/{id}',
  method: 'put',
  summary: 'Rename / re-permission a role (user_management_role update)',
  responses: [
    { status: 200, description: 'Role updated' },
    { status: 403, description: 'Not allowed / administrator role locked' },
    { status: 404, description: 'Role not found' },
    { status: 409, description: 'Name taken / SYSTEM role rename' },
  ],
})

registerPath({
  path: '/roles/{id}',
  method: 'delete',
  summary: 'Delete an unused USER role (user_management_role delete)',
  responses: [
    { status: 200, description: 'Role deleted' },
    { status: 403, description: 'Not allowed / administrator role locked' },
    { status: 404, description: 'Role not found' },
    { status: 409, description: 'SYSTEM role or role still in use' },
  ],
})
