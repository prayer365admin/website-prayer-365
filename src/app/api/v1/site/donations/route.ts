import { NextRequest } from 'next/server'
import { SiteDonationInitiateSchema } from '@/models/donation'
import { initiateDonation } from '@/controller/donation'
import requiredWebAuth from '@/utils/required-webauth'
import { GeneralError } from '@/utils/general-error'
import { NotImplementedError } from '@/utils/not-implemented-error'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'

/*
 * POST /api/v1/site/donations — website checkout start (WB-40).
 *
 * The church travels in the body and the giver comes from the session, so the
 * browser can neither address another parish nor name another giver. The shared
 * `initiateDonation` controller owns eligibility, validation and the provider
 * call; the website adds no Stripe code of its own. A disabled integration
 * surfaces as 503 DONATIONS_NOT_READY (the W11 "not ready" state), never as a
 * fake success.
 */
export async function POST(req: NextRequest) {
  try {
    const { session } = await requiredWebAuth()
    const { churchId, ...input } = validate(SiteDonationInitiateSchema, await req.json())
    const result = await initiateDonation({
      churchId,
      userId: session.user.user_id,
      input,
      idempotencyKey: req.headers.get('idempotency-key') || crypto.randomUUID(),
    })
    return ok(result, 'Donation session created.')
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
