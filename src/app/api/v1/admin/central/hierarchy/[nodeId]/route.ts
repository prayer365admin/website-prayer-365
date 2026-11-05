import { NextRequest } from 'next/server'
import { z } from 'zod'
import { updateNode } from '@/controller/hierarchy'
import { NodeUpdateSchema } from '@/models/hierarchy'
import { registerPath } from '@/utils/openapi'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, ok, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'

registerPath({
  path: '/admin/central/hierarchy/{nodeId}',
  method: 'patch',
  summary: 'Rename or re-parent an org node (cycles rejected)',
  request: {
    params: [{ name: 'nodeId', in: 'path', schema: z.string() }],
    body: z.object({
      version: z.number().int().positive(),
      name: z.string().optional(),
      parentId: z.string().nullable().optional(),
      move: z.enum(['up', 'down']).optional(),
    }),
  },
  responses: [{ status: 200, description: 'Updated node', schema: z.object({ id: z.string() }) }],
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ nodeId: string }> }) {
  try {
    const { session } = await requiredAuth(req)
    const actorId = session.user.user_id
    await requiredScope({
      userId: actorId,
      central: true,
      subject: 'prayer_hierarchy',
      action: 'update',
    })
    const { nodeId } = await params
    const body = await req.json().catch(() => ({}))
    const payload = validate(NodeUpdateSchema, body)
    const result = await updateNode({ nodeId, payload, actorId, requestId: genRequestId() })
    return ok(result, 'Node updated', 200)
  } catch (e) {
    return httpError(e)
  }
}
