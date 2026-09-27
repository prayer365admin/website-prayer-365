import { getMe } from '@/controller/me'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import requiredAuth from '@/utils/required-auth'
import { z } from 'zod'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const result = await getMe({ user_id: session.user.user_id })
    return ok(result, 'Successfully retrieved identity')
  } catch (error) {
    return httpError(error)
  }
}

registerPath({
  path: '/admin/me',
  method: 'get',
  summary: 'Safe identity and accessible scopes for the caller',
  responses: [
    {
      status: 200,
      description: 'Identity + scopes',
      schema: z.object({
        success: z.literal(true),
        message: z.string(),
        result: z.object({
          id: z.string(),
          email: z.string(),
          name: z.string().nullable(),
          scopes: z.array(z.object({ kind: z.string(), orgNodeId: z.string(), name: z.string() })),
        }),
        request_id: z.string(),
      }),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'User not found' },
  ],
})
