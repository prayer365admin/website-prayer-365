import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { list, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MobileChurchListQuerySchema, MobileChurchSummarySchema } from '@/models/mobile'
import { listPublicChurches } from '@/controller/mobile'

/*
 * GET /api/v1/mobile/churches — discovery/search of APPROVED churches
 * (SPEC §8.4 / Task 39). Only APPROVED churches are served; suspended and
 * archived are never returned. Summary rows expose no private fields.
 */

registerPath({
  path: '/mobile/churches',
  method: 'get',
  summary: 'Search/nearby approved churches (public summary)',
  request: {
    params: [
      { name: 'search', in: 'query', required: false, schema: z.string() },
      { name: 'page', in: 'query', required: false, schema: z.string() },
      { name: 'limit', in: 'query', required: false, schema: z.string() },
      { name: 'latitude', in: 'query', required: false, schema: z.string() },
      { name: 'longitude', in: 'query', required: false, schema: z.string() },
      { name: 'radius_km', in: 'query', required: false, schema: z.string() },
      { name: 'denomination', in: 'query', required: false, schema: z.string() },
      { name: 'language', in: 'query', required: false, schema: z.string() },
      { name: 'sunday_live_stream', in: 'query', required: false, schema: z.string() },
      { name: 'taize_chants', in: 'query', required: false, schema: z.string() },
      { name: 'youth_ministry', in: 'query', required: false, schema: z.string() },
    ],
  },
  responses: [
    { status: 200, description: 'Approved church summaries', schema: MobileChurchSummarySchema },
    { status: 401, description: 'Not authenticated' },
  ],
})

export async function GET(req: NextRequest) {
  try {
    await requiredAuth(req)
    const query = validate(
      MobileChurchListQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams),
    )
    const { result, total } = await listPublicChurches({ query })
    return list(result as unknown[], total, query.page, query.limit, 'Churches retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
