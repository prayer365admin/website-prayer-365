import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { registerPath } from '@/utils/openapi'
import { httpError, noStore, ok } from '@/utils/response'
import { getMyActiveGift } from '@/controller/donation'
import type { MobileActiveDonation } from '@/models/mobile-donation'

/*
 * GET /api/v1/mobile/me/donations — F11 "Manage monthly gift" entry (MB-02 / BA-4).
 *
 * The giver's own active pledge, resolved from the token: no client-supplied
 * customer, subscription or church id is ever trusted. The app uses it to show the
 * manage row on a church profile only when that church is the pledged one.
 *
 * `result: null` is the normal answer for most givers — "no active pledge" is not
 * an error and must not be a 404, or every profile open would look broken. The
 * provider is reconciled on read (`GET_MY_ACTIVE_GIFT`), so a pledge cancelled in
 * the provider portal disappears here without a webhook, and the answer is never
 * cached.
 */

registerPath({
  path: '/mobile/me/donations',
  method: 'get',
  summary: 'Read the caller’s own active monthly pledge',
  responses: [
    { status: 200, description: 'Active pledge, or null when the caller has none' },
    { status: 401, description: 'Not authenticated' },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const gift = await getMyActiveGift({ userId: session.user.user_id })
    if (!gift) return noStore(ok(null, 'No active pledge.'))

    const result: MobileActiveDonation = {
      churchId: gift.churchId,
      churchName: gift.churchName,
      amountMinor: gift.amountMinor,
      currency: gift.currency.toLowerCase(),
      frequency: 'monthly',
    }
    return noStore(ok(result, 'Active pledge retrieved.'))
  } catch (e) {
    return httpError(e)
  }
}
