import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { GeneralError } from '@/utils/general-error'
import { NotImplementedError } from '@/utils/not-implemented-error'
import { registerPath } from '@/utils/openapi'
import { httpError, noStore, ok } from '@/utils/response'
import { expireDonationAttempt } from '@/controller/donation'

/*
 * POST /api/v1/mobile/me/donation-attempts/:sessionId/expire — F11 "start over".
 *
 * Closes the caller's own OPEN checkout session so the app can mint a replacement without risking a
 * double charge. A session that already completed answers `completed`: the app then reads the
 * status instead of starting a second payment. The session must belong to the caller (404 if not).
 */

registerPath({
  path: '/mobile/me/donation-attempts/:sessionId/expire',
  method: 'post',
  summary: 'Expire the caller’s open checkout session (start over)',
  request: { params: [{ name: 'sessionId', in: 'path', schema: z.string() }] },
  responses: [
    { status: 200, description: 'state: expired | completed' },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'Attempt not found (or not the caller’s)' },
    { status: 503, description: 'Donations are not configured (DONATIONS_NOT_READY)' },
  ],
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { session } = await requiredAuth(req)
    const { sessionId } = await params
    const result = await expireDonationAttempt({ userId: session.user.user_id, sessionId })
    return noStore(ok(result, 'Donation attempt closed.'))
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
