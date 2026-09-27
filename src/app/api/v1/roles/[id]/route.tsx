import { GET_ROLE_BY_ID } from '@/providers/role'
import { ok, httpError } from '@/utils/response'
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

// Inherited role mutation is disabled (SPEC §8.3). Keep as a deny, not a bypass.
export async function PUT(_req: NextRequest, _segmentData: { params: Params }) {
  return httpError(
    new GeneralError({
      code: 403,
      error: 'FORBIDDEN',
      error_code: 'ROUTE_DISABLED',
      details: 'Role editing is disabled.',
    }),
  )
}

export async function DELETE(_req: NextRequest, _segmentData: { params: Params }) {
  return httpError(
    new GeneralError({
      code: 403,
      error: 'FORBIDDEN',
      error_code: 'ROUTE_DISABLED',
      details: 'Role deletion is disabled.',
    }),
  )
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
  summary: 'Disabled — role editing disabled (403)',
  responses: [{ status: 403, description: 'Route disabled' }],
})

registerPath({
  path: '/roles/{id}',
  method: 'delete',
  summary: 'Disabled — role deletion disabled (403)',
  responses: [{ status: 403, description: 'Route disabled' }],
})
