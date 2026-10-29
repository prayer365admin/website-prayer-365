import { NextRequest } from 'next/server'
import { setFollow } from '@/controller/mobile'
import requiredCustomer from '@/utils/required-customer'
import { httpError, ok } from '@/utils/response'

/*
 * PUT / DELETE /api/v1/site/me/follows/:churchId — follow / unfollow (WB-16).
 * Subject-only; the church must be APPROVED (404 otherwise).
 *
 * CUSTOMER-ONLY (plan 022): following writes a user_churches row, which the
 * dashboard counts as a church member. The follow button lives on the public
 * church page, so the guard cannot come from the page alone.
 */

type Params = { params: Promise<{ churchId: string }> }

const follow = async ({ params }: Params, isFollowed: boolean) => {
  try {
    const { session } = await requiredCustomer()
    const { churchId } = await params
    const result = await setFollow({ userId: session.user.user_id, churchId, isFollowed })

    return ok(result, isFollowed ? 'Church followed.' : 'Church unfollowed.')
  } catch (e) {
    return httpError(e)
  }
}

export const PUT = (_req: NextRequest, ctx: Params) => follow(ctx, true)

export const DELETE = (_req: NextRequest, ctx: Params) => follow(ctx, false)
