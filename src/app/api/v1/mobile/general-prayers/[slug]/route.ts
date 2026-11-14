import { NextRequest } from 'next/server'
import { z } from 'zod'
import { GeneralError } from '@/utils/general-error'
import { noStore, ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { MobileGeneralPrayerSchema } from '@/models/general-prayer'
import { getMobileGeneralPrayerBySlug } from '@/controller/general-prayer'

/*
 * GET /api/v1/mobile/general-prayers/:slug — deep-link landing for an older
 * push/email (GP-MOB-02). Public like the page it mirrors (D-GP-7): an email or
 * push can be opened before the app has a session. The slug resolves against
 * ACTIVE rows only, so an inactive or unknown slug answers 404 (never a
 * redirect to another prayer).
 */

registerPath({
  path: '/mobile/general-prayers/:slug',
  method: 'get',
  summary: 'Platform daily prayer by slug (deep-link landing)',
  request: { params: [{ name: 'slug', in: 'path', schema: z.string() }] },
  responses: [
    { status: 200, description: 'Prayer payload', schema: MobileGeneralPrayerSchema },
    { status: 404, description: 'Slug unknown or inactive' },
  ],
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const result = await getMobileGeneralPrayerBySlug({ slug })
    if (!result) {
      throw new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'Daily prayer not found or not available.',
      })
    }
    return noStore(ok(result, 'Daily prayer retrieved.'))
  } catch (e) {
    return httpError(e)
  }
}
