import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { list, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MobileChurchListQuerySchema, MobilePublicEventSchema } from '@/models/mobile'
import { listPublicEvents } from '@/controller/mobile'

/*
 * GET /api/v1/mobile/churches/:churchId/events — published/upcoming events for
 * an APPROVED church (SPEC §8.4 / Task 42). Future-oriented (starts_at >=
 * now) and ordered by starts_at. Optional `category` narrows via query.search.
 */

registerPath({
  path: '/mobile/churches/:churchId/events',
  method: 'get',
  summary: 'Published events for an approved church',
  request: {
    params: [
      { name: 'churchId', in: 'path', schema: z.string() },
      { name: 'page', in: 'query', required: false, schema: z.string() },
      { name: 'limit', in: 'query', required: false, schema: z.string() },
      { name: 'search', in: 'query', required: false, schema: z.string() },
    ],
  },
  responses: [
    { status: 200, description: 'Published events', schema: MobilePublicEventSchema },
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
    const { result, total } = await listPublicEvents({ churchId, query })
    return list(result as unknown[], total, query.page, query.limit, 'Events retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
