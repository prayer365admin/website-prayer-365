import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createLanguage, listLanguages } from '@/controller/registry'
import { LanguageCreateSchema } from '@/models/registry'
import { registerPath } from '@/utils/openapi'
import { parseListQuery } from '@/utils/pagination'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, list, ok, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'

registerPath({
  path: '/admin/central/languages',
  method: 'get',
  summary: 'List language registry',
  responses: [
    {
      status: 200,
      description: 'List of languages',
      schema: z.array(z.object({ code: z.string() })),
    },
  ],
})

registerPath({
  path: '/admin/central/languages',
  method: 'post',
  summary: 'Create a language',
  request: { body: LanguageCreateSchema },
  responses: [
    { status: 201, description: 'Created language', schema: z.object({ code: z.string() }) },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_language',
      action: 'read',
    })
    const q = parseListQuery(req.nextUrl.searchParams, {
      allowOrderBy: ['code', 'name'],
      defaults: ['code'],
    })
    const data = await listLanguages({
      page: q.page,
      limit: q.limit,
      order_direction: q.order_direction,
    })
    return list(data.result, data.total, q.page, q.limit, 'Successfully fetched languages')
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
      subject: 'prayer_language',
      action: 'create',
    })
    const body = await req.json().catch(() => ({}))
    const payload = validate(LanguageCreateSchema, body)
    const result = await createLanguage({ payload, actorId, requestId: genRequestId() })
    return ok(result, 'Language created', 201)
  } catch (e) {
    return httpError(e)
  }
}
