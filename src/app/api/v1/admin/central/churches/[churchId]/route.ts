import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getChurch, updateChurch } from '@/controller/central-church'
import { ChurchUpdateSchema } from '@/models/central-church'
import { registerPath } from '@/utils/openapi'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, ok, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'

registerPath({
  path: '/admin/central/churches/{churchId}',
  method: 'get',
  summary: 'Fetch one church setup (any status)',
  request: { params: [{ name: 'churchId', in: 'path', schema: z.string() }] },
  responses: [{ status: 200, description: 'Church setup', schema: z.object({ id: z.string() }) }],
})

registerPath({
  path: '/admin/central/churches/{churchId}',
  method: 'patch',
  summary: 'Update church setup (validated fields + version)',
  request: {
    params: [{ name: 'churchId', in: 'path', schema: z.string() }],
    body: z.object({
      version: z.number().int().positive(),
      name: z.string().optional(),
      timezone: z.string().optional(),
      description: z.string().nullable().optional(),
      denomination: z.string().nullable().optional(),
      latitude: z.number().nullable().optional(),
      longitude: z.number().nullable().optional(),
      sunday_live_stream: z.boolean().nullable().optional(),
      taize_chants: z.boolean().nullable().optional(),
      youth_ministry: z.boolean().nullable().optional(),
    }),
  },
  responses: [{ status: 200, description: 'Updated church', schema: z.object({ id: z.string() }) }],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    const { session } = await requiredAuth(req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_church',
      action: 'read',
    })
    const { churchId } = await params
    const result = await getChurch({ churchId })
    return ok(result, 'Successfully fetched church', 200)
  } catch (e) {
    return httpError(e)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string }> },
) {
  try {
    const { session } = await requiredAuth(req)
    const actorId = session.user.user_id
    await requiredScope({
      userId: actorId,
      central: true,
      subject: 'prayer_church',
      action: 'update',
    })
    const { churchId } = await params
    const body = await req.json().catch(() => ({}))
    const payload = validate(ChurchUpdateSchema, body)
    const result = await updateChurch({ churchId, payload, actorId, requestId: genRequestId() })
    return ok(result, 'Church updated', 200)
  } catch (e) {
    return httpError(e)
  }
}
