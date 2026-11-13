import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { noStore, ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { GeneralPrayerOutputSchema, GeneralPrayerUpdateSchema } from '@/models/general-prayer'
import { getGeneralPrayer, updateGeneralPrayer } from '@/controller/general-prayer'
import { SITE_PUBLIC_TAG } from '@/utils/site-cache-tags'

/*
 * GET/PATCH /api/v1/admin/central/general-prayers/:generalPrayerId (GP-API-03).
 *
 * PATCH is optimistic: `version` is required and a stale value is answered with
 * 409 STALE_VERSION, so two editors cannot silently overwrite each other.
 */

const generalPrayerIdParam = { name: 'generalPrayerId', in: 'path' as const, schema: z.string() }

registerPath({
  path: '/admin/central/general-prayers/:generalPrayerId',
  method: 'get',
  summary: 'Get one general prayer',
  request: { params: [generalPrayerIdParam] },
  responses: [
    { status: 200, description: 'General prayer detail', schema: GeneralPrayerOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Not found' },
  ],
})

registerPath({
  path: '/admin/central/general-prayers/:generalPrayerId',
  method: 'patch',
  summary: 'Update a general prayer (version-guarded)',
  request: { params: [generalPrayerIdParam], body: GeneralPrayerUpdateSchema },
  responses: [
    { status: 200, description: 'Updated general prayer', schema: GeneralPrayerOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Not found' },
    { status: 409, description: 'Stale version' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function GET(
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
      action: 'read',
    })
    const result = await getGeneralPrayer({ generalPrayerId })
    return noStore(ok(result, 'General prayer retrieved.'))
  } catch (e) {
    return httpError(e)
  }
}

export async function PATCH(
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
    const input = validate(GeneralPrayerUpdateSchema, await req.json())
    const result = await updateGeneralPrayer({
      userId: session.user.user_id,
      generalPrayerId,
      input,
      requestId: requestId(),
    })
    revalidateTag(SITE_PUBLIC_TAG, { expire: 0 })
    return noStore(ok(result, 'General prayer updated.'))
  } catch (e) {
    return httpError(e)
  }
}
