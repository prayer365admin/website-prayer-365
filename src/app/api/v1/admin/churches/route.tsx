import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { list, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { ChurchListQuerySchema, ChurchSummarySchema } from '@/models/church'
import { listChurches } from '@/controller/church'

/*
 * GET /api/v1/admin/churches — paginated list of the caller's assigned
 * churches (SPEC §8.2). The controller resolves the union scope across all
 * active assignments and the provider applies the churchId filter to both
 * count and rows.
 */

registerPath({
  path: '/admin/churches',
  method: 'get',
  summary: 'List assigned churches',
  request: {
    params: [
      { name: 'page', in: 'query', schema: z.coerce.number().int().positive().default(1) },
      {
        name: 'limit',
        in: 'query',
        schema: z.coerce.number().int().positive().max(100).default(25),
      },
      { name: 'search', in: 'query', schema: z.string().optional() },
      { name: 'order_by', in: 'query', schema: z.enum(['name', 'created_at']).default('name') },
      { name: 'order_direction', in: 'query', schema: z.enum(['asc', 'desc']).default('asc') },
    ],
  },
  responses: [
    {
      status: 200,
      description: 'Assigned church summaries',
      schema: z.object({
        success: z.boolean(),
        message: z.string(),
        result: z.array(ChurchSummarySchema),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
        request_id: z.string(),
      }),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const query = validate(ChurchListQuerySchema, Object.fromEntries(req.nextUrl.searchParams))
    const { result, total } = await listChurches({ userId: session.user.user_id, query })
    return list(result, total, query.page, query.limit, 'Churches retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
