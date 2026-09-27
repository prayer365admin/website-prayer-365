import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { setFollow } from '@/controller/mobile'

/*
 * PUT / DELETE /api/v1/mobile/me/follows/:churchId (SPEC §8.4 / Task 40).
 * PUT follows, DELETE unfollows (toggles is_followed on the user's row).
 * Subject-only; church must be APPROVED.
 */

const followSchema = z.object({ churchId: z.string(), isFollowed: z.boolean() })

registerPath({
  path: '/mobile/me/follows/:churchId',
  method: 'put',
  summary: 'Follow an approved church',
  request: { params: [{ name: 'churchId', in: 'path', schema: z.string() }] },
  responses: [
    { status: 200, description: 'Follow state', schema: followSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'Church not found or not approved' },
  ],
})

registerPath({
  path: '/mobile/me/follows/:churchId',
  method: 'delete',
  summary: 'Unfollow a church',
  request: { params: [{ name: 'churchId', in: 'path', schema: z.string() }] },
  responses: [
    { status: 200, description: 'Follow state', schema: followSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'Church not found or not approved' },
  ],
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    const { session } = await requiredAuth(req)
    const { churchId } = await params
    const result = await setFollow({
      userId: session.user.user_id,
      churchId,
      isFollowed: true,
    })
    return ok(result, 'Church followed.')
  } catch (e) {
    return httpError(e)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string }> },
) {
  try {
    const { session } = await requiredAuth(req)
    const { churchId } = await params
    const result = await setFollow({
      userId: session.user.user_id,
      churchId,
      isFollowed: false,
    })
    return ok(result, 'Church unfollowed.')
  } catch (e) {
    return httpError(e)
  }
}
