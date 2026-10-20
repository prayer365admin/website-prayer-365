import { NextRequest } from 'next/server'
import { MobileRequestInputSchema } from '@/models/mobile'
import { submitRequest } from '@/controller/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'

/*
 * POST /api/v1/site/churches/:churchId/requests — website prayer petition (WB3 Home).
 * Cookie-session twin of the mobile route: same shared submitRequest (APPROVED
 * church, Idempotency-Key, rate limit, minimal ack, no payload logged).
 *
 * Idempotency: the client key is used when the caller sends one (Home petition hook,
 * church-page form); otherwise a key is generated server-side so a caller that omits
 * the header is still protected against a duplicate on retry.
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string }> },
) {
  try {
    const { session } = await requiredWebAuth()
    const { churchId } = await params
    const input = validate(MobileRequestInputSchema, await req.json())
    const result = await submitRequest({
      userId: session.user.user_id,
      churchId,
      input,
      idempotencyKey: req.headers.get('idempotency-key') || crypto.randomUUID(),
      requestId: requestId(),
    })
    return ok(result, 'Request received.')
  } catch (e) {
    return httpError(e)
  }
}
