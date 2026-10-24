import { deactivateUser, updateUser } from '@/controller/user'
import { UserPayloadUpdateModel } from '@/models/user'
import { GET_USER_BY_ID } from '@/providers/user'
import { ok, httpError, requestId } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { GeneralError } from '@/utils/general-error'
import requiredAuth from '@/utils/required-auth'
import { z } from 'zod'
import { NextRequest } from 'next/server'

type Params = Promise<{ id: string }>

type PasswordShaped = { password?: string | null | undefined }
function protect<T extends PasswordShaped>(row: T): Omit<T, 'password'> {
  const { password: _pw, ...safe } = row
  return safe
}

export async function GET(req: NextRequest, segmentData: { params: Params }) {
  const params = await segmentData.params
  const id = params.id
  try {
    const { permission } = await requiredAuth(req)

    if (!permission.readAny('prayer_administrator').granted) {
      return httpError(
        new GeneralError({
          code: 403,
          error: 'UNAUTHORIZED',
          error_code: 'NOT_ALLOWED',
          details: 'This account is not allowed for this action.',
        }),
      )
    }

    const result = await GET_USER_BY_ID({ user_id: id })
    if (!result) {
      return httpError(
        new GeneralError({
          code: 404,
          error: 'NOT_FOUND',
          error_code: 'USER_NOT_FOUND',
          details: 'User not found.',
        }),
      )
    }

    return ok(protect(result), `Successfully retrieve data with id ${id}!`)
  } catch (error) {
    return httpError(error)
  }
}

export async function PUT(req: NextRequest, segmentData: { params: Params }) {
  const payload: UserPayloadUpdateModel = await req.json()
  const params = await segmentData.params
  const id = params.id
  try {
    const { session, permission } = await requiredAuth(req)

    if (!permission.updateAny('prayer_administrator').granted) {
      return httpError(
        new GeneralError({
          code: 403,
          error: 'UNAUTHORIZED',
          error_code: 'NOT_ALLOWED',
          details: 'This account is not allowed for this action.',
        }),
      )
    }

    const existing = await GET_USER_BY_ID({ user_id: id })
    if (!existing) {
      return httpError(
        new GeneralError({
          code: 404,
          error: 'NOT_FOUND',
          error_code: 'USER_NOT_FOUND',
          details: 'User not found.',
        }),
      )
    }

    const result = await updateUser({
      user_id: id,
      payload,
      actorId: session.user.user_id,
      requestId: requestId(),
    })
    return ok(result, `Successfully update data with id ${id}!`)
  } catch (error) {
    return httpError(error)
  }
}

registerPath({
  path: '/users/{id}',
  method: 'get',
  summary: 'Staff detail (central prayer_administrator, no password)',
  request: { params: [{ name: 'id', in: 'path', schema: z.string() }] },
  responses: [
    {
      status: 200,
      description: 'User detail (no password)',
      schema: z.object({
        success: z.literal(true),
        message: z.string(),
        result: z.object({ id: z.string(), email: z.string(), name: z.string() }),
        request_id: z.string(),
      }),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Forbidden' },
    { status: 404, description: 'User not found' },
  ],
})

/**
 * DELETE /api/v1/users/:id — DEACTIVATE (soft delete, plan 023). The dashboard's
 * Users list calls this, so the label there is "Deactivate", not "Delete".
 */
export async function DELETE(req: NextRequest, segmentData: { params: Params }) {
  const params = await segmentData.params
  try {
    const { session, permission } = await requiredAuth(req)

    if (!permission.deleteAny('user_management_user').granted) {
      return httpError(
        new GeneralError({
          code: 403,
          error: 'UNAUTHORIZED',
          error_code: 'NOT_ALLOWED',
          details: 'This account is not allowed for this action.',
        }),
      )
    }

    const result = await deactivateUser({
      user_id: params.id,
      actorId: session.user.user_id,
      requestId: requestId(),
    })
    return ok(protect(result), `Successfully deactivated user ${params.id}!`)
  } catch (error) {
    return httpError(error)
  }
}

registerPath({
  path: '/users/{id}',
  method: 'put',
  summary: 'Update staff (role_id rejected, no password returned)',
  request: {
    params: [{ name: 'id', in: 'path', schema: z.string() }],
    body: z.object({
      name: z.string().optional(),
      role_id: z.string().optional().nullable(),
      password: z.string().optional(),
      email_verified_at: z.string().optional(),
      profile_picture: z.string().optional(),
    }),
  },
  responses: [
    {
      status: 200,
      description: 'Updated user (no password)',
      schema: z.object({
        success: z.literal(true),
        message: z.string(),
        result: z.object({ id: z.string(), email: z.string(), name: z.string() }),
        request_id: z.string(),
      }),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Forbidden' },
    { status: 422, description: 'Validation error (role_id rejected)' },
  ],
})
