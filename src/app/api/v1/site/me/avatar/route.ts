import { NextRequest } from 'next/server'
import { createMobileAvatar } from '@/controller/mobile-avatar'
import { MobileAvatarUploadInputSchema } from '@/models/mobile-avatar'
import requiredWebAuth from '@/utils/required-webauth'
import { httpError, ok } from '@/utils/response'
import { validate } from '@/utils/validate'

/*
 * POST /api/v1/site/me/avatar — sign a user-scoped avatar upload (WB-16).
 * Same controller as the mobile avatar route, cookie session instead of
 * bearer. The client uploads to S3, then PATCHes site/me profilePicture.
 */

export async function POST(req: NextRequest) {
  try {
    const { session } = await requiredWebAuth()
    const input = validate(MobileAvatarUploadInputSchema, await req.json())
    const result = await createMobileAvatar({ userId: session.user.user_id, input })

    return ok(result, 'Avatar upload URL created.')
  } catch (e) {
    return httpError(e)
  }
}
