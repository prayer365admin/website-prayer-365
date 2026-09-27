import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MobileCheckInAckSchema, MobileCheckInInputSchema } from '@/models/mobile'
import { checkIn } from '@/controller/mobile'

/*
 * POST /api/v1/mobile/churches/:churchId/check-ins (SPEC §8.4 / Task 43, D7).
 * Server time is authoritative; D7 dedupe (one user/church/local-date via a
 * unique dedupe_key) makes re-check-ins idempotent. Empty/minimal body.
 */

registerPath({
  path: '/mobile/churches/:churchId/check-ins',
  method: 'post',
  summary: 'Check in to an approved church (server time, D7 dedupe)',
  request: {
    params: [{ name: 'churchId', in: 'path', schema: z.string() }],
    body: MobileCheckInInputSchema,
  },
  responses: [
    {
      status: 200,
      description: 'Check-in acknowledged (idempotent)',
      schema: MobileCheckInAckSchema,
    },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'Church not found or not approved' },
    { status: 409, description: 'Idempotency key reused with a different payload' },
  ],
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string }> },
) {
  try {
    const { session } = await requiredAuth(req)
    const { churchId } = await params
    const body = await req.json().catch(() => ({}))
    validate(MobileCheckInInputSchema, body)
    const idempotencyKey = req.headers.get('idempotency-key') ?? undefined
    const result = await checkIn({
      userId: session.user.user_id,
      churchId,
      idempotencyKey,
      requestId: requestId(),
    })
    return ok(result, 'Check-in recorded.')
  } catch (e) {
    return httpError(e)
  }
}
