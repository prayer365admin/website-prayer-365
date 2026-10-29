import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { list, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { CentralPrayerListQuerySchema, CentralPrayerOutputSchema } from '@/models/prayer'
import { listCentralPrayers } from '@/controller/prayer'
import { z } from 'zod'

/*
 * GET /api/v1/admin/central/prayers (plan 023).
 * prayer_prayer:read over the caller's whole central subtree, so the super admin
 * can see prayers across churches instead of opening one church at a time.
 * `churchId` only narrows inside that scope.
 */

registerPath({
  path: '/admin/central/prayers',
  method: 'get',
  summary: 'Cross-church prayer list (central prayer_prayer read)',
  request: {
    params: [
      { name: 'page', in: 'query' as const, schema: z.coerce.number().int().positive() },
      { name: 'limit', in: 'query' as const, schema: z.coerce.number().int().positive() },
      { name: 'order_by', in: 'query' as const, schema: z.enum(['created_at', 'published_at']) },
      { name: 'order_direction', in: 'query' as const, schema: z.enum(['asc', 'desc']) },
      { name: 'status', in: 'query' as const, schema: z.enum(['current', 'archive']) },
      { name: 'search', in: 'query' as const, schema: z.string() },
      { name: 'churchId', in: 'query' as const, schema: z.string() },
    ],
  },
  responses: [
    {
      status: 200,
      description: 'Prayers across churches under the central node',
      schema: z.array(CentralPrayerOutputSchema),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_prayer',
      action: 'read',
    })
    const query = validate(
      CentralPrayerListQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams),
    )
    const { result, total } = await listCentralPrayers({ churchIds, query })
    return list(result, total, query.page, query.limit, 'Prayers retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
