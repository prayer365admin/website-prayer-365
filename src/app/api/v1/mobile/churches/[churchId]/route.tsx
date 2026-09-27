import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MobileChurchListQuerySchema, MobilePublicChurchSchema } from '@/models/mobile'
import { getPublicChurch } from '@/controller/mobile'

/*
 * GET /api/v1/mobile/churches/:churchId — public church profile of an
 * APPROVED church (SPEC §8.4 / Task 39). Never exposes approved_by/at,
 * payment/balance, or contact PII beyond the public website/address/contacts.
 * Unapproved/suspended/archived churches return 404.
 */

registerPath({
  path: '/mobile/churches/:churchId',
  method: 'get',
  summary: 'Public church profile (approved only)',
  request: { params: [{ name: 'churchId', in: 'path', schema: z.string() }] },
  responses: [
    { status: 200, description: 'Public church profile', schema: MobilePublicChurchSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'Church not found or not approved' },
  ],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    await requiredAuth(req)
    const { churchId } = await params
    const query = validate(
      MobileChurchListQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams),
    )
    const result = await getPublicChurch({ churchId, query })
    return ok(result, 'Church profile retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
