import { NextRequest } from 'next/server'
import { setFollow } from '@/controller/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { httpError, ok } from '@/utils/response'

/*
 * PUT / DELETE /api/v1/site/me/follows/:churchId — follow / unfollow (WB-16).
 * Subject-only; the church must be APPROVED (404 otherwise).
 */

type Params = { params: Promise<{ churchId: string }> }

const follow = async ({ params }: Params, isFollowed: boolean) => {
  try {
    const { session } = await requiredWebAuth()
    const { churchId } = await params
    const result = await setFollow({ userId: session.user.user_id, churchId, isFollowed })

    return ok(result, isFollowed ? 'Church followed.' : 'Church unfollowed.')
  } catch (e) {
    return httpError(e)
  }
}

export const PUT = (_req: NextRequest, ctx: Params) => follow(ctx, true)

export const DELETE = (_req: NextRequest, ctx: Params) => follow(ctx, false)
