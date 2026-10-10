import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import {
  MobileAvatarUploadInputSchema,
  MobileAvatarUploadOutputSchema,
} from '@/models/mobile-avatar'
import { createMobileAvatar } from '@/controller/mobile-avatar'

/*
 * POST /api/v1/mobile/me/avatar (MB-16 / SPEC §8.4).
 * Subject-only: the object key is always scoped to the session user. Image-only
 * (jpeg/png/webp/heic) and ≤8MB, enforced by the schema + the signed POST
 * conditions. No media_assets row, no church scope.
 */

registerPath({
  path: '/mobile/me/avatar',
  method: 'post',
  summary: 'Sign a user-scoped avatar upload (S3 presigned POST)',
  request: { body: MobileAvatarUploadInputSchema },
  responses: [
    { status: 200, description: 'Signed upload URL', schema: MobileAvatarUploadOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 422, description: 'Validation error (MIME / size)' },
  ],
})

export async function POST(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const input = validate(MobileAvatarUploadInputSchema, await req.json())
    const result = await createMobileAvatar({ userId: session.user.user_id, input })
    return ok(result, 'Avatar upload URL created.')
  } catch (e) {
    return httpError(e)
  }
}
