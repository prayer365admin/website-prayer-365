import { NextRequest } from 'next/server'
import { z } from 'zod'
import { revokeRoleAssignment } from '@/controller/role-assignment'
import { registerPath } from '@/utils/openapi'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, ok, requestId as genRequestId } from '@/utils/response'

registerPath({
  path: '/admin/central/role-assignments/{assignmentId}',
  method: 'delete',
  summary: 'Revoke a role assignment (soft delete via revoked_at)',
  request: { params: [{ name: 'assignmentId', in: 'path', schema: z.string() }] },
  responses: [
    {
      status: 200,
      description: 'Revoked assignment',
      schema: z.object({ id: z.string(), revoked_at: z.string().nullable() }),
    },
  ],
})

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  try {
    const { session } = await requiredAuth(req)
    const actorId = session.user.user_id
    await requiredScope({
      userId: actorId,
      central: true,
      subject: 'prayer_role_assignment',
      action: 'delete',
    })
    const { assignmentId } = await params
    const result = await revokeRoleAssignment({ assignmentId, actorId, requestId: genRequestId() })
    return ok(result, 'Role assignment revoked', 200)
  } catch (e) {
    return httpError(e)
  }
}
