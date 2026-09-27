import { GET_PERMISSIONS } from '@/providers/permission'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { GeneralError } from '@/utils/general-error'
import requiredAuth from '@/utils/required-auth'
import { z } from 'zod'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { permission } = await requiredAuth(req)

    if (!permission.readAny('prayer_permission').granted) {
      return httpError(
        new GeneralError({
          code: 403,
          error: 'UNAUTHORIZED',
          error_code: 'NOT_ALLOWED',
          details: 'This account is not allowed for this action.',
        }),
      )
    }

    const result = await GET_PERMISSIONS()
    return ok(result, 'Successfully get all permission!')
  } catch (error) {
    return httpError(error)
  }
}

registerPath({
  path: '/permissions',
  method: 'get',
  summary: 'Fixed Prayer permission catalogue (central prayer_permission read)',
  responses: [
    {
      status: 200,
      description: 'Permission catalogue',
      schema: z.object({
        success: z.literal(true),
        message: z.string(),
        result: z.array(z.object({ id: z.string(), subject: z.string(), actions: z.string() })),
        request_id: z.string(),
      }),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Forbidden' },
  ],
})
