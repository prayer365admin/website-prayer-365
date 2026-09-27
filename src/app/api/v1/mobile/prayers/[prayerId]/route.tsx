import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { MobilePublishedPrayerSchema } from '@/models/mobile'
import { getPublishedPrayer } from '@/controller/mobile'

/*
 * GET /api/v1/mobile/prayers/:prayerId — a single published prayer
 * (SPEC §8.4 / Task 41). Only served when the owning church is APPROVED and
 * the prayer has published_version_id + published_at. Draft/current snapshots
 * are never returned.
 */

registerPath({
  path: '/mobile/prayers/:prayerId',
  method: 'get',
  summary: 'Published prayer detail (published snapshot + approved audio)',
  request: { params: [{ name: 'prayerId', in: 'path', schema: z.string() }] },
  responses: [
    { status: 200, description: 'Published prayer', schema: MobilePublishedPrayerSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'Prayer not published or church not approved' },
  ],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ prayerId: string }> }) {
  try {
    await requiredAuth(req)
    const { prayerId } = await params
    const result = await getPublishedPrayer({ prayerId })
    return ok(result, 'Prayer retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
