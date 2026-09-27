import { GET_ROLES } from '@/providers/role'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { GeneralError } from '@/utils/general-error'
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

// Inherited role creation is disabled (SPEC §8.3) — role wiring is done via
// scoped role assignments. Never retain this as an authorization bypass.
export async function POST(_req: NextRequest) {
  return httpError(
    new GeneralError({
      code: 403,
      error: 'FORBIDDEN',
      error_code: 'ROUTE_DISABLED',
      details: 'Role creation is disabled; roles are managed via role assignments.',
    }),
  )
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
  summary: 'Disabled — role creation is disabled (403)',
  responses: [{ status: 403, description: 'Route disabled' }],
})
