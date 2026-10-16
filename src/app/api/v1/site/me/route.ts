import { NextRequest } from 'next/server'
import { getMe, patchMe } from '@/controller/mobile'
import { SiteMePatchSchema } from '@/models/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { httpError, ok } from '@/utils/response'
import { validate } from '@/utils/validate'

/*
 * GET / PATCH /api/v1/site/me — website profile (WB-16), cookie session.
 * Subject-only. PATCH reuses the shared patchMe (transactional single is_main)
 * but validates with SiteMePatchSchema: main church and locale cannot be
 * cleared, locale is a site locale.
 */

export async function GET() {
  try {
    const { session } = await requiredWebAuth()
    const result = await getMe({ userId: session.user.user_id })

    return ok(result, 'Successfully fetched profile')
  } catch (e) {
    return httpError(e)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { session } = await requiredWebAuth()
    const data = validate(SiteMePatchSchema, await req.json())
    const result = await patchMe({ userId: session.user.user_id, data })

    return ok(result, 'Profile updated.')
  } catch (e) {
    return httpError(e)
  }
}
