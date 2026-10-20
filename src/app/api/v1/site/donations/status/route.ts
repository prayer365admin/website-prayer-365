import { NextRequest } from 'next/server'
import { DonationStatusQuerySchema } from '@/models/donation'
import { getDonationStatus } from '@/controller/donation'
import requiredWebAuth from '@/utils/required-webauth'
import { httpError, noStore, ok } from '@/utils/response'
import { validate } from '@/utils/validate'

/*
 * GET /api/v1/site/donations/status — W12 result page (WB-42).
 *
 * The Stripe redirect only carries the attempt's shape; the outcome comes from
 * our own records scoped to the signed-in giver, so a crafted URL can never
 * turn itself into a confirmed donation. Private data → never cached.
 */
export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredWebAuth()
    const query = validate(DonationStatusQuerySchema, Object.fromEntries(req.nextUrl.searchParams))
    const result = await getDonationStatus({ userId: session.user.user_id, query })
    return noStore(ok(result, 'Donation status retrieved.'))
  } catch (e) {
    return httpError(e)
  }
}
