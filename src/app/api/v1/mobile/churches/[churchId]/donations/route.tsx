import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { GeneralError } from '@/utils/general-error'
import { NotImplementedError } from '@/utils/not-implemented-error'
import { registerPath } from '@/utils/openapi'
import { httpError, ok } from '@/utils/response'
import { validate } from '@/utils/validate'
import { MobileDonationInitiateSchema } from '@/models/mobile-donation'
import { initiateDonation } from '@/controller/donation'

/*
 * POST /api/v1/mobile/churches/:churchId/donations — F11 checkout start (MB-02 / BA-1).
 *
 * The church is the path and the giver is the bearer token, so the client can name neither
 * another parish nor another giver. No card data ever reaches this handler: the provider's own
 * page is the only card surface, and `initiateDonation` rejects card-shaped payloads outright.
 *
 * The Idempotency-Key header is REQUIRED (unlike the website route, which invents one). The app
 * mints a key per attempt and replays it byte-identically on retry, so the same key returns the
 * same checkout session instead of charging twice. A missing header is a client bug: fail loudly.
 */

registerPath({
  path: '/mobile/churches/:churchId/donations',
  method: 'post',
  summary: 'Start a hosted checkout session for a church gift (idempotent)',
  request: {
    params: [{ name: 'churchId', in: 'path', schema: z.string() }],
    body: MobileDonationInitiateSchema,
  },
  responses: [
    { status: 200, description: 'Checkout session created' },
    { status: 400, description: 'Missing Idempotency-Key or church not eligible' },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'Church not found' },
    { status: 409, description: 'Idempotency key reused with a different payload' },
    { status: 422, description: 'Validation error' },
    { status: 503, description: 'Donations are not configured (DONATIONS_NOT_READY)' },
  ],
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string }> },
) {
  try {
    const { session } = await requiredAuth(req)
    const { churchId } = await params

    const idempotencyKey = req.headers.get('idempotency-key')?.trim()
    if (!idempotencyKey) {
      throw new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'IDEMPOTENCY_KEY_REQUIRED',
        details: 'The Idempotency-Key header is required.',
      })
    }

    const input = validate(MobileDonationInitiateSchema, await req.json())
    const result = await initiateDonation({
      churchId,
      userId: session.user.user_id,
      input,
      idempotencyKey,
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
