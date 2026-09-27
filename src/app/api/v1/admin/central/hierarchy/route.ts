import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createNode, getHierarchyTree } from '@/controller/hierarchy'
import { NodeCreateSchema } from '@/models/hierarchy'
import { registerPath } from '@/utils/openapi'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, ok, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'

registerPath({
  path: '/admin/central/hierarchy',
  method: 'get',
  summary: 'Fetch the org hierarchy tree',
  responses: [
    { status: 200, description: 'Hierarchy tree', schema: z.array(z.object({ id: z.string() })) },
  ],
})

registerPath({
  path: '/admin/central/hierarchy',
  method: 'post',
  summary: 'Create an org node (parent-type validated)',
  request: { body: NodeCreateSchema },
  responses: [{ status: 201, description: 'Created node', schema: z.object({ id: z.string() }) }],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_hierarchy',
      action: 'read',
    })
    const result = await getHierarchyTree()
    return ok(result, 'Successfully fetched hierarchy', 200)
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
      subject: 'prayer_hierarchy',
      action: 'create',
    })
    const body = await req.json().catch(() => ({}))
    const payload = validate(NodeCreateSchema, body)
    const result = await createNode({ payload, actorId, requestId: genRequestId() })
    return ok(result, 'Node created', 201)
  } catch (e) {
    return httpError(e)
  }
}
