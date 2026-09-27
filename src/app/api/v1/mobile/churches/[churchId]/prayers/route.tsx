import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { list, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MobileChurchListQuerySchema, MobilePublishedPrayerSchema } from '@/models/mobile'
import { listPublishedPrayers } from '@/controller/mobile'

/*
 * GET /api/v1/mobile/churches/:churchId/prayers — published prayers of an
 * APPROVED church (SPEC §8.4 / Task 41). Only prayers with published_version_id
 * AND published_at are served, returning the PUBLISHED snapshot (not the
 * current/draft) plus the approved audio URL when present.
 */

registerPath({
  path: '/mobile/churches/:churchId/prayers',
  method: 'get',
  summary: 'Published prayers (published snapshot + approved audio)',
  request: {
    params: [
      { name: 'churchId', in: 'path', schema: z.string() },
      { name: 'page', in: 'query', required: false, schema: z.string() },
      { name: 'limit', in: 'query', required: false, schema: z.string() },
    ],
  },
  responses: [
    { status: 200, description: 'Published prayers', schema: MobilePublishedPrayerSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'Church not found or not approved' },
  ],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    await requiredAuth(req)
    const { churchId } = await params
    const query = validate(
      MobileChurchListQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams),
    )
    const { result, total } = await listPublishedPrayers({ churchId, query })
    return list(result as unknown[], total, query.page, query.limit, 'Prayers retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
