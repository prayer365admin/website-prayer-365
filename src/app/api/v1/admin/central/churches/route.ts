import { ChurchStatus } from '@prisma/client'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createChurch, listChurches } from '@/controller/central-church'
import { ChurchCreateSchema } from '@/models/central-church'
import { registerPath } from '@/utils/openapi'
import { parseListQuery } from '@/utils/pagination'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, list, ok, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'

registerPath({
  path: '/admin/central/churches',
  method: 'get',
  summary: 'List churches (any status)',
  responses: [
    { status: 200, description: 'List of churches', schema: z.array(z.object({ id: z.string() })) },
  ],
})

registerPath({
  path: '/admin/central/churches',
  method: 'post',
  summary: 'Create an org CHURCH node + PENDING church transactionally',
  request: {
    body: z.object({
      name: z.string(),
      timezone: z.string(),
      parentId: z.string().optional(),
      description: z.string().optional(),
      denomination: z.string().optional(),
      address: z.record(z.string(), z.unknown()).optional(),
      contacts: z.record(z.string(), z.unknown()).optional(),
      latitude: z.number().nullable().optional(),
      longitude: z.number().nullable().optional(),
      sunday_live_stream: z.boolean().nullable().optional(),
      taize_chants: z.boolean().nullable().optional(),
      youth_ministry: z.boolean().nullable().optional(),
    }),
  },
  responses: [
    { status: 201, description: 'Pending church created', schema: z.object({ id: z.string() }) },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_church',
      action: 'read',
    })
    const q = parseListQuery(req.nextUrl.searchParams, { allowOrderBy: ['created_at', 'name'] })
    const status = (req.nextUrl.searchParams.get('status') as ChurchStatus | null) ?? undefined
    const data = await listChurches({
      page: q.page,
      limit: q.limit,
      order_direction: q.order_direction,
      status,
      search: q.search,
    })
    return list(data.result, data.total, q.page, q.limit, 'Successfully fetched churches')
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
      subject: 'prayer_church',
      action: 'create',
    })
    const body = await req.json().catch(() => ({}))
    const payload = validate(ChurchCreateSchema, body)
    const result = await createChurch({ payload, actorId, requestId: genRequestId() })
    return ok(result, 'Church created', 201)
  } catch (e) {
    return httpError(e)
  }
}
