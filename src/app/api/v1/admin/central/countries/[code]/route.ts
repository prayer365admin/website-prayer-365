import { NextRequest } from 'next/server'
import { z } from 'zod'
import { deleteCountry, updateCountry } from '@/controller/registry'
import { CountryUpdateSchema } from '@/models/registry'
import { registerPath } from '@/utils/openapi'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, ok, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'

registerPath({
  path: '/admin/central/countries/{code}',
  method: 'patch',
  summary: 'Update a country',
  request: {
    params: [{ name: 'code', in: 'path', schema: z.string() }],
    body: z.object({
      version: z.number().int().positive(),
      name: z.string().optional(),
      enabled: z.boolean().optional(),
    }),
  },
  responses: [
    { status: 200, description: 'Updated country', schema: z.object({ code: z.string() }) },
  ],
})

registerPath({
  path: '/admin/central/countries/{code}',
  method: 'delete',
  summary: 'Delete an unreferenced country (referenced rows are protected)',
  request: { params: [{ name: 'code', in: 'path', schema: z.string() }] },
  responses: [
    { status: 200, description: 'Deleted country', schema: z.object({ code: z.string() }) },
  ],
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { session } = await requiredAuth(req)
    const actorId = session.user.user_id
    await requiredScope({
      userId: actorId,
      central: true,
      subject: 'prayer_country',
      action: 'update',
    })
    const { code } = await params
    const body = await req.json().catch(() => ({}))
    const payload = validate(CountryUpdateSchema, body)
    const result = await updateCountry({ code, payload, actorId, requestId: genRequestId() })
    return ok(result, 'Country updated', 200)
  } catch (e) {
    return httpError(e)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { session } = await requiredAuth(req)
    const actorId = session.user.user_id
    await requiredScope({
      userId: actorId,
      central: true,
      subject: 'prayer_country',
      action: 'delete',
    })
    const { code } = await params
    const result = await deleteCountry({ code, actorId, requestId: genRequestId() })
    return ok(result, 'Country deleted', 200)
  } catch (e) {
    return httpError(e)
  }
}
