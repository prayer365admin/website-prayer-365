import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { list, noStore, ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import {
  GeneralPrayerCreateSchema,
  GeneralPrayerListQuerySchema,
  GeneralPrayerOutputSchema,
} from '@/models/general-prayer'
import { createGeneralPrayer, listGeneralPrayers } from '@/controller/general-prayer'
import { SITE_PUBLIC_TAG } from '@/utils/site-cache-tags'

/*
 * GET/POST /api/v1/admin/central/general-prayers (GP-API-03).
 *
 * Platform content: the guard is `central: true` with `prayer_general_prayer`,
 * which the global admin and the dedicated prayer admin hold. There is no
 * church tenancy filter — a general prayer belongs to no church.
 */

registerPath({
  path: '/admin/central/general-prayers',
  method: 'get',
  summary: 'List general prayers (central prayer_general_prayer read)',
  request: {
    params: [
      { name: 'page', in: 'query' as const, schema: z.coerce.number().int().positive() },
      { name: 'limit', in: 'query' as const, schema: z.coerce.number().int().positive() },
      { name: 'search', in: 'query' as const, schema: z.string() },
      { name: 'isActive', in: 'query' as const, schema: z.enum(['true', 'false']) },
    ],
  },
  responses: [
    {
      status: 200,
      description: 'General prayer cycle',
      schema: z.array(GeneralPrayerOutputSchema),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
  ],
})

registerPath({
  path: '/admin/central/general-prayers',
  method: 'post',
  summary: 'Create a general prayer',
  request: { body: GeneralPrayerCreateSchema },
  responses: [
    { status: 201, description: 'Created general prayer', schema: GeneralPrayerOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 409, description: 'Sequence already used' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_general_prayer',
      action: 'read',
    })
    const query = validate(
      GeneralPrayerListQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams),
    )
    const { result, total } = await listGeneralPrayers({ query })
    // Authenticated JSON: never stored by a shared cache (SPEC §2.2).
    return noStore(
      list(result as unknown[], total, query.page, query.limit, 'General prayers retrieved.'),
    )
  } catch (e) {
    return httpError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_general_prayer',
      action: 'create',
    })
    const input = validate(GeneralPrayerCreateSchema, await req.json())
    const result = await createGeneralPrayer({
      userId: session.user.user_id,
      input,
      requestId: requestId(),
    })
    // The public cycle page reads a cached projection of these rows.
    revalidateTag(SITE_PUBLIC_TAG, { expire: 0 })
    return noStore(ok(result, 'General prayer created.', 201))
  } catch (e) {
    return httpError(e)
  }
}
