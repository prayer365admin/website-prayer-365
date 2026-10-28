import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { GeneralError } from '@/utils/general-error'
import { NotImplementedError } from '@/utils/not-implemented-error'
import { registerPath } from '@/utils/openapi'
import { httpError, noStore, ok } from '@/utils/response'
import { validate } from '@/utils/validate'
import { MobileBillingPortalRequestSchema } from '@/models/mobile-donation'
import { openBillingPortal } from '@/controller/donation'

/*
 * POST /api/v1/mobile/me/donations/portal — F11 "Manage monthly gift" (MB-02 / BA-3).
 *
 * The giver pauses or changes their own pledge inside the provider's hosted billing portal; this
 * handler only mints the session. The subscription is resolved from the caller's own active
 * pledge, so no client-supplied customer or subscription id is ever trusted, and the return URL
 * must be an app return target.
 */

registerPath({
  path: '/mobile/me/donations/portal',
  method: 'post',
  summary: 'Open the provider billing portal for the caller’s own monthly pledge',
  request: { body: MobileBillingPortalRequestSchema },
  responses: [
    { status: 200, description: 'Billing portal session created' },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'No active subscription' },
    { status: 422, description: 'Validation error' },
    { status: 502, description: 'Provider customer missing' },
    { status: 503, description: 'Donations are not configured (DONATIONS_NOT_READY)' },
  ],
})

export async function POST(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const { returnUrl } = validate(MobileBillingPortalRequestSchema, await req.json())
    const result = await openBillingPortal({ userId: session.user.user_id, returnUrl })
    return noStore(ok(result, 'Billing portal session created.'))
  } catch (e) {
    if (e instanceof NotImplementedError) {
      return httpError(
        new GeneralError({
          code: 503,
          error: 'SERVICE_UNAVAILABLE',
          error_code: 'DONATIONS_NOT_READY',
          details: 'Donations are not ready yet. Please try again later.',
        }),
      )
    }
    return httpError(e)
  }
}
