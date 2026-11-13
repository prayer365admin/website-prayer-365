import { NextRequest } from 'next/server'
import { getPublicDonationStatus } from '@/controller/donation'
import { PublicDonationStatusQuerySchema } from '@/models/donation'
import { httpError, noStore, ok } from '@/utils/response'
import { validate } from '@/utils/validate'

/*
 * GET /api/v1/site/donations/public/status — anonymous outcome read (PD-API-03).
 *
 * The thank-you page asks about exactly one checkout session; the session id is
 * regex-gated and the controller answers 404 for anything that is not the
 * platform's own (D-14), so a crafted id can never surface another giver's
 * outcome. Private data → never cached.
 */
export async function GET(req: NextRequest) {
  try {
    const query = validate(
      PublicDonationStatusQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams),
    )
    const result = await getPublicDonationStatus({ query })
    return noStore(ok(result, 'Donation status retrieved.'))
  } catch (e) {
    return httpError(e)
  }
}
