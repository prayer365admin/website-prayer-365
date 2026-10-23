import { NextRequest } from 'next/server'
import { BillingPortalRequestSchema } from '@/models/donation'
import { openBillingPortal } from '@/controller/donation'
import requiredWebAuth from '@/utils/required-webauth'
import { GeneralError } from '@/utils/general-error'
import { NotImplementedError } from '@/utils/not-implemented-error'
import { httpError, noStore, ok } from '@/utils/response'
import { validate } from '@/utils/validate'

/*
 * POST /api/v1/site/donations/portal — W11 "Pause or Modify Monthly Pledge" (WB-41).
 *
 * The giver pauses or changes their own pledge in Stripe's hosted billing
 * portal; this route only mints the session. The subscription is resolved from
 * the signed-in giver's own active pledge, so no client-supplied subscription or
 * customer id is ever trusted. Private data → never cached.
 */
export async function POST(req: NextRequest) {
  try {
    const { session } = await requiredWebAuth()
    // The body is optional: without it the giver returns to the donate portal.
    const body = await req.json().catch(() => ({}))
    const { returnPath = '/donate' } = validate(BillingPortalRequestSchema, body)
    // Relative resolve only: returnPath is validated to start with /donate, so
    // the composed URL can never leave this origin.
    const returnUrl = new URL(returnPath, req.nextUrl.origin).toString()
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
