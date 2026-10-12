import { NextRequest } from 'next/server'
import { z } from 'zod'
import { deleteLanguage, updateLanguage } from '@/controller/registry'
import { LanguageUpdateSchema } from '@/models/registry'
import { registerPath } from '@/utils/openapi'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, ok, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'

registerPath({
  path: '/admin/central/languages/{code}',
  method: 'patch',
  summary: 'Update a language',
  request: {
    params: [{ name: 'code', in: 'path', schema: z.string() }],
    body: z.object({
      version: z.number().int().positive(),
      name: z.string().optional(),
      enabled: z.boolean().optional(),
    }),
  },
  responses: [
    { status: 200, description: 'Updated language', schema: z.object({ code: z.string() }) },
  ],
})

registerPath({
  path: '/admin/central/languages/{code}',
  method: 'delete',
  summary: 'Delete an unreferenced language (referenced rows are protected)',
  request: { params: [{ name: 'code', in: 'path', schema: z.string() }] },
  responses: [
    { status: 200, description: 'Deleted language', schema: z.object({ code: z.string() }) },
  ],
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { session } = await requiredAuth(req)
    const actorId = session.user.user_id
    await requiredScope({
      userId: actorId,
      central: true,
      subject: 'prayer_language',
      action: 'update',
    })
    const { code } = await params
    const body = await req.json().catch(() => ({}))
    const payload = validate(LanguageUpdateSchema, body)
    const result = await updateLanguage({ code, payload, actorId, requestId: genRequestId() })
    return ok(result, 'Language updated', 200)
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
      subject: 'prayer_language',
      action: 'delete',
    })
    const { code } = await params
    const result = await deleteLanguage({ code, actorId, requestId: genRequestId() })
    return ok(result, 'Language deleted', 200)
  } catch (e) {
    return httpError(e)
  }
}
