import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { noStore, ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { GeneralPrayerOutputSchema } from '@/models/general-prayer'
import { enqueueGeneralPrayerAudio } from '@/controller/general-prayer'
import { SITE_PUBLIC_TAG } from '@/utils/site-cache-tags'

/*
 * POST /api/v1/admin/central/general-prayers/:generalPrayerId/audio (GP-API-04).
 *
 * Enqueues `general_prayer.audio`. One row per content version (dedupe key), so
 * a double click is absorbed; a generation already in flight is a 409.
 */

const generalPrayerIdParam = { name: 'generalPrayerId', in: 'path' as const, schema: z.string() }

registerPath({
  path: '/admin/central/general-prayers/:generalPrayerId/audio',
  method: 'post',
  summary: 'Generate (or regenerate) the general prayer audio',
  request: { params: [generalPrayerIdParam] },
  responses: [
    { status: 202, description: 'Audio job queued', schema: GeneralPrayerOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Not found' },
    { status: 409, description: 'Audio already generating' },
  ],
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ generalPrayerId: string }> },
) {
  try {
    const { generalPrayerId } = await params
    const { session } = await requiredAuth(req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_general_prayer',
      action: 'update',
    })
    const result = await enqueueGeneralPrayerAudio({ generalPrayerId })
    revalidateTag(SITE_PUBLIC_TAG, { expire: 0 })
    return noStore(ok(result, 'Audio generation queued.', 202))
  } catch (e) {
    return httpError(e)
  }
}
