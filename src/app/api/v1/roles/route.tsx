import { createRole } from '@/controller/role'
import { GET_ROLES } from '@/providers/role'
import { RolePayloadCrateSchema, RolePayloadCrateModel } from '@/models/role'
import { ok, httpError, requestId } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { GeneralError } from '@/utils/general-error'
import { validate } from '@/utils/validate'
import requiredAuth from '@/utils/required-auth'
import { RoleType } from '@prisma/client'
import { z } from 'zod'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const type = searchParams.get('type') ? (searchParams.get('type') as RoleType) : undefined

  try {
    const { permission } = await requiredAuth(req)

    if (!permission.readAny('prayer_role').granted) {
      return httpError(
        new GeneralError({
          code: 403,
          error: 'UNAUTHORIZED',
          error_code: 'NOT_ALLOWED',
          details: 'This account is not allowed for this action.',
        }),
      )
    }

    const result = await GET_ROLES({ type: type })

    return ok(result, 'Successfully get all role!')
  } catch (error) {
    return httpError(error)
  }
}

// Role creation is enabled again (plan 023) with the guards in controller/role:
// `administrator` and SYSTEM roles are protected, names must be unique.
export async function POST(req: NextRequest) {
  try {
    const { session, permission } = await requiredAuth(req)

    if (!permission.createAny('user_management_role').granted) {
      return httpError(
        new GeneralError({
          code: 403,
          error: 'UNAUTHORIZED',
          error_code: 'NOT_ALLOWED',
          details: 'This account is not allowed for this action.',
        }),
      )
    }

    const payload: RolePayloadCrateModel = validate(
      RolePayloadCrateSchema,
      await req.json().catch(() => ({})),
    )
    const result = await createRole({
      payload,
      actorId: session.user.user_id,
      requestId: requestId(),
    })
    return ok(result, 'Role created.', 201)
  } catch (error) {
    return httpError(error)
  }
}

registerPath({
  path: '/roles',
  method: 'get',
  summary: 'Role catalogue (central prayer_role read)',
  request: {
    params: [{ name: 'type', in: 'query', required: false, schema: z.string().optional() }],
  },
  responses: [
    {
      status: 200,
      description: 'Role catalogue',
      schema: z.object({
        success: z.literal(true),
        message: z.string(),
        result: z.array(z.object({ id: z.string(), name: z.string() })),
        request_id: z.string(),
      }),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Forbidden' },
  ],
})

registerPath({
  path: '/roles',
  method: 'post',
  summary: 'Create a role with its permission matrix (user_management_role create)',
  request: { body: RolePayloadCrateSchema },
  responses: [
    { status: 201, description: 'Role created' },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed / administrator role locked' },
    { status: 409, description: 'Role name already exists' },
    { status: 422, description: 'Validation error' },
  ],
})
