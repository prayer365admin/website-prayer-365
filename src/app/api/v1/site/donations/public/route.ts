import { NextRequest } from 'next/server'
import { initiatePublicDonation } from '@/controller/donation'
import { GeneralError } from '@/utils/general-error'
import { NotImplementedError } from '@/utils/not-implemented-error'
import { ok, httpError } from '@/utils/response'

/*
 * POST /api/v1/site/donations/public — anonymous checkout start (PD-API-03).
 *
 * No session is read: this is the one giving entry point a visitor without an
 * account can use. The route holds no beneficiary logic of its own — the
 * controller resolves the platform row server-side, builds the return URLs from
 * `SITE_URL` and creates no idempotency record (D-12, D-13). Like every other
 * `site/**` route it stays out of the OpenAPI registry (D-16).
 */
export async function POST(req: NextRequest) {
  try {
    const result = await initiatePublicDonation({ input: await req.json() })
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
