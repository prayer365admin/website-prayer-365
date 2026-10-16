import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { ChurchOptionQuerySchema, ChurchOptionSchema } from '@/models/church-option'
import { listChurchOptions } from '@/controller/church-option'

/*
 * GET /api/v1/public/churches?search= — public church picker for sign-up
 * (WB1). No session. APPROVED churches only, at most 20, {id, name, city}.
 */

registerPath({
  path: '/public/churches',
  method: 'get',
  auth: false,
  summary: 'Search approved churches for the sign-up picker (public, minimal fields)',
  request: {
    params: [{ name: 'search', in: 'query', required: false, schema: z.string() }],
  },
  responses: [
    { status: 200, description: 'Church options', schema: z.array(ChurchOptionSchema) },
    { status: 422, description: 'Validation error' },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const query = validate(ChurchOptionQuerySchema, Object.fromEntries(req.nextUrl.searchParams))
    const result = await listChurchOptions({ query })
    return ok(result, 'Churches retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
