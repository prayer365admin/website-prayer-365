import { getEffectiveAccess } from '@/controller/access'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import requiredAuth from '@/utils/required-auth'
import { z } from 'zod'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)

    const churchId = req.nextUrl.searchParams.get('churchId') ?? undefined
    const regionId = req.nextUrl.searchParams.get('regionId') ?? undefined

    const result = await getEffectiveAccess({ userId: session.user.user_id, churchId, regionId })
    return ok(result, 'Successfully retrieved effective access')
  } catch (error) {
    return httpError(error)
  }
}

registerPath({
  path: '/admin/access',
  method: 'get',
  summary: 'Effective permission catalogue for a church or region scope',
  request: {
    params: [
      { name: 'churchId', in: 'query', required: false, schema: z.string().optional() },
      { name: 'regionId', in: 'query', required: false, schema: z.string().optional() },
    ],
  },
  responses: [
    {
      status: 200,
      description: 'Effective subjects/actions',
      schema: z.object({
        success: z.literal(true),
        message: z.string(),
        result: z.object({
          scope: z.object({ kind: z.string(), orgNodeId: z.string(), name: z.string() }),
          subjects: z.record(z.string(), z.array(z.string())),
        }),
        request_id: z.string(),
      }),
    },
    { status: 400, description: 'Exactly one of churchId/regionId required' },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'Scope not found' },
  ],
})
