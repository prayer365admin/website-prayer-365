import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MobileRequestAckSchema, MobileRequestInputSchema } from '@/models/mobile'
import { submitRequest } from '@/controller/mobile'

/*
 * POST /api/v1/mobile/churches/:churchId/requests (SPEC §8.4 / Task 43, §9.5).
 * Submits a prayer/pastoral/meeting request idempotently (Idempotency-Key).
 * The response is a MINIMAL ack — staff/other-user detail is never echoed and
 * no private payload is logged. Church must be APPROVED.
 */

registerPath({
  path: '/mobile/churches/:churchId/requests',
  method: 'post',
  summary: 'Submit a prayer/pastoral/meeting request (idempotent ack)',
  request: {
    params: [{ name: 'churchId', in: 'path', schema: z.string() }],
    body: MobileRequestInputSchema,
  },
  responses: [
    { status: 200, description: 'Request acknowledged', schema: MobileRequestAckSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'Church not found or not approved' },
    { status: 422, description: 'Validation error (subject required for prayer)' },
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
    const input = validate(MobileRequestInputSchema, await req.json())
    const idempotencyKey = req.headers.get('idempotency-key') ?? undefined
    const result = await submitRequest({
      userId: session.user.user_id,
      churchId,
      input,
      idempotencyKey,
      requestId: requestId(),
    })
    return ok(result, 'Request received.')
  } catch (e) {
    return httpError(e)
  }
}
