import { NextRequest } from 'next/server'
import { MobileRequestInputSchema } from '@/models/mobile'
import { submitRequest } from '@/controller/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string }> },
) {
  try {
    const { user } = await requiredWebAuth()
    const { churchId } = await params
    const input = validate(MobileRequestInputSchema, await req.json())
    const idempotencyKey = req.headers.get('idempotency-key') || crypto.randomUUID()
    const result = await submitRequest({
      userId: user.id,
      churchId,
      input,
      idempotencyKey,
      requestId: requestId(),
    })
    return ok(result, 'Prayer petition submitted successfully.')
  } catch (e) {
    return httpError(e)
  }
}
