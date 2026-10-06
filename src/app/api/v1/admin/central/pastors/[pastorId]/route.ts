import { NextRequest } from 'next/server'
import { z } from 'zod'
import { deletePastor, getPastor, updatePastor } from '@/controller/pastor'
import { PastorUpdateSchema } from '@/models/pastor'
import { registerPath } from '@/utils/openapi'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, ok, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'

registerPath({
  path: '/admin/central/pastors/{pastorId}',
  method: 'get',
  summary: 'Get a central pastor profile',
  request: {
    params: [{ name: 'pastorId', in: 'path', schema: z.string() }],
  },
  responses: [{ status: 200, description: 'Pastor profile', schema: z.object({ id: z.string() }) }],
})

registerPath({
  path: '/admin/central/pastors/{pastorId}',
  method: 'delete',
  summary: 'Delete an unreferenced pastor profile',
  request: {
    params: [{ name: 'pastorId', in: 'path', schema: z.string() }],
  },
  responses: [{ status: 204, description: 'Pastor deleted' }],
})

registerPath({
  path: '/admin/central/pastors/{pastorId}',
  method: 'patch',
  summary: 'Update a central pastor profile (global authority)',
  request: {
    params: [{ name: 'pastorId', in: 'path', schema: z.string() }],
    body: z.object({
      version: z.number().int().positive(),
      name: z.string().optional(),
      introduction: z.string().nullable().optional(),
      imageAssetId: z.string().uuid().nullable().optional(),
      userId: z.string().nullable().optional(),
    }),
  },
  responses: [{ status: 200, description: 'Updated pastor', schema: z.object({ id: z.string() }) }],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ pastorId: string }> }) {
  try {
    const { session } = await requiredAuth(req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_pastor',
      action: 'read',
    })
    const { pastorId } = await params
    const result = await getPastor({ pastorId })
    return ok(result, 'Pastor retrieved', 200)
  } catch (e) {
    return httpError(e)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pastorId: string }> },
) {
  try {
    const { session } = await requiredAuth(req)
    const actorId = session.user.user_id
    await requiredScope({
      userId: actorId,
      central: true,
      subject: 'prayer_pastor',
      action: 'update',
    })
    const { pastorId } = await params
    const body = await req.json().catch(() => ({}))
    const payload = validate(PastorUpdateSchema, body)
    const result = await updatePastor({ pastorId, payload, actorId, requestId: genRequestId() })
    return ok(result, 'Pastor updated', 200)
  } catch (e) {
    return httpError(e)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pastorId: string }> },
) {
  try {
    const { session } = await requiredAuth(req)
    const actorId = session.user.user_id
    await requiredScope({
      userId: actorId,
      central: true,
      subject: 'prayer_pastor',
      action: 'delete',
    })
    const { pastorId } = await params
    await deletePastor({ pastorId, actorId, requestId: genRequestId() })
    return new Response(null, { status: 204 })
  } catch (e) {
    return httpError(e)
  }
}
