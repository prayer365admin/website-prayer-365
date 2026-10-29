import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { registerPath } from '@/utils/openapi'
import { httpError, noStore, ok } from '@/utils/response'
import { validate } from '@/utils/validate'
import { MobileDonationStatusQuerySchema } from '@/models/mobile-donation'
import { getDonationStatus } from '@/controller/donation'

/*
 * GET /api/v1/mobile/me/donation-attempts — F11 outcome read (MB-02 / BA-2).
 *
 * The attempt is read from OUR ledger, scoped to the caller, by the tuple the checkout produced
 * (church + amount + currency + frequency + provider session). A crafted query can therefore
 * never turn itself into a confirmed gift, and a redirect URL is never evidence: `confirmed`
 * requires a PAID row. The app polls this with a bounded backoff, so keep it cheap and
 * never cache it.
 */

registerPath({
  path: '/mobile/me/donation-attempts',
  method: 'get',
  summary: 'Read the caller’s own donation attempt outcome from the ledger',
  request: {
    params: [
      { name: 'sessionId', in: 'query', schema: z.string() },
      { name: 'churchId', in: 'query', schema: z.string() },
      { name: 'amountMinor', in: 'query', required: false, schema: z.string() },
      { name: 'currency', in: 'query', schema: z.string() },
      { name: 'frequency', in: 'query', schema: z.string() },
    ],
  },
  responses: [
    { status: 200, description: 'Attempt outcome (confirmed | pending | failed)' },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'Church not found' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const query = validate(
      MobileDonationStatusQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams),
    )
    const result = await getDonationStatus({ userId: session.user.user_id, query })
    return noStore(ok(result, 'Donation status retrieved.'))
  } catch (e) {
    return httpError(e)
  }
}
