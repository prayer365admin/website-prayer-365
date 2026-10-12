import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createCountry, listCountries } from '@/controller/registry'
import { CountryCreateSchema } from '@/models/registry'
import { registerPath } from '@/utils/openapi'
import { parseListQuery } from '@/utils/pagination'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, list, ok, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'

registerPath({
  path: '/admin/central/countries',
  method: 'get',
  summary: 'List country registry',
  responses: [
    {
      status: 200,
      description: 'List of countries',
      schema: z.array(z.object({ code: z.string() })),
    },
  ],
})

registerPath({
  path: '/admin/central/countries',
  method: 'post',
  summary: 'Create a country',
  request: { body: CountryCreateSchema },
  responses: [
    { status: 201, description: 'Created country', schema: z.object({ code: z.string() }) },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_country',
      action: 'read',
    })
    const q = parseListQuery(req.nextUrl.searchParams, {
      allowOrderBy: ['name', 'code'],
      defaults: ['name'],
    })
    const data = await listCountries({
      page: q.page,
      limit: q.limit,
      order_direction: q.order_direction,
    })
    return list(data.result, data.total, q.page, q.limit, 'Successfully fetched countries')
  } catch (e) {
    return httpError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const actorId = session.user.user_id
    await requiredScope({
      userId: actorId,
      central: true,
      subject: 'prayer_country',
      action: 'create',
    })
    const body = await req.json().catch(() => ({}))
    const payload = validate(CountryCreateSchema, body)
    const result = await createCountry({ payload, actorId, requestId: genRequestId() })
    return ok(result, 'Country created', 201)
  } catch (e) {
    return httpError(e)
  }
}
