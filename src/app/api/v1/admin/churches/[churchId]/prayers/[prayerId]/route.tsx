import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { PrayerInputSchema, PrayerOutputSchema } from '@/models/prayer'
import { getPrayer, patchPrayer } from '@/controller/prayer'

/*
 * GET/PATCH /api/v1/admin/churches/:churchId/prayers/:prayerId (Task 21).
 * PATCH creates a NEW immutable text snapshot and repoints the current pointer;
 * it never mutates an approved snapshot. Stale version → 409.
 */

const paramsDecls = [
  { name: 'churchId', in: 'path' as const, schema: z.string() },
  { name: 'prayerId', in: 'path' as const, schema: z.string() },
]

registerPath({
  path: '/admin/churches/:churchId/prayers/:prayerId',
  method: 'get',
  summary: 'Get prayer editor DTO',
  request: { params: paramsDecls },
  responses: [
    { status: 200, description: 'Prayer', schema: PrayerOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Prayer not found or out of scope' },
  ],
})

registerPath({
  path: '/admin/churches/:churchId/prayers/:prayerId',
  method: 'patch',
  summary: 'Create a new prayer text version',
  request: { params: paramsDecls, body: PrayerInputSchema },
  responses: [
    { status: 200, description: 'Updated prayer', schema: PrayerOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Prayer not found or out of scope' },
    { status: 409, description: 'Stale version' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string; prayerId: string }> },
) {
  try {
    const { churchId, prayerId } = await params
    const { session } = await requiredAuth(req)
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_prayer',
      action: 'read',
    })
    const result = await getPrayer({ churchIds, prayerId })
    return ok(result, 'Prayer retrieved.')
  } catch (e) {
    return httpError(e)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string; prayerId: string }> },
) {
  try {
    const { churchId, prayerId } = await params
    const { session } = await requiredAuth(req)
    const input = validate(PrayerInputSchema, await req.json())
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_prayer',
      action: 'update',
    })
    const result = await patchPrayer({
      userId: session.user.user_id,
      churchId,
      churchIds,
      prayerId,
      input,
      requestId: requestId(),
    })
    return ok(result, 'Prayer version created.')
  } catch (e) {
    return httpError(e)
  }
}
