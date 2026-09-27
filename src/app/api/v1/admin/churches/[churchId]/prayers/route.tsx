import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, list, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { PrayerInputSchema, PrayerListQuerySchema, PrayerOutputSchema } from '@/models/prayer'
import { createPrayer, listPrayers } from '@/controller/prayer'

/*
 * GET/POST /api/v1/admin/churches/:churchId/prayers (SPEC §8.2 / Task 21).
 * POST creates the Prayer + initial immutable PrayerVersion + current pointer
 * in one transaction. GET is scope-filtered by churchIds.
 */

const churchIdParam = { name: 'churchId', in: 'path' as const, schema: z.string() }

registerPath({
  path: '/admin/churches/:churchId/prayers',
  method: 'post',
  summary: 'Create a prayer with its initial version',
  request: { params: [churchIdParam], body: PrayerInputSchema },
  responses: [
    { status: 200, description: 'Created prayer', schema: PrayerOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Church not found or out of scope' },
    { status: 422, description: 'Validation error (pastor/language)' },
  ],
})

registerPath({
  path: '/admin/churches/:churchId/prayers',
  method: 'get',
  summary: 'List prayers',
  request: {
    params: [churchIdParam],
  },
  responses: [
    { status: 200, description: 'Prayer list', schema: PrayerOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
  ],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    const { churchId } = await params
    const { session } = await requiredAuth(req)
    const query = validate(PrayerListQuerySchema, Object.fromEntries(req.nextUrl.searchParams))
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_prayer',
      action: 'read',
    })
    const { result, total } = await listPrayers({ churchIds, query })
    return list(result as unknown[], total, query.page, query.limit, 'Prayers retrieved.')
  } catch (e) {
    return httpError(e)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string }> },
) {
  try {
    const { churchId } = await params
    const { session } = await requiredAuth(req)
    const input = validate(PrayerInputSchema, await req.json())
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_prayer',
      action: 'create',
    })
    const result = await createPrayer({
      userId: session.user.user_id,
      churchId,
      churchIds,
      input,
      requestId: requestId(),
    })
    return ok(result, 'Prayer created.', 201)
  } catch (e) {
    return httpError(e)
  }
}
