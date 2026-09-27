import { AccessControl } from 'accesscontrol'
import { RoleDataModel } from '@/models/role'
import { RoleAssignmentCreate, RoleAssignmentSummary } from '@/models/role-assignment'
import { GET_USER_SCOPE_DATA } from '@/providers/scope'
import {
  CREATE_ROLE_ASSIGNMENT,
  GET_ACTIVE_ASSIGNMENT,
  GET_ASSIGNMENT_BY_ID,
  GET_ORG_NODE_BY_ID,
  GET_ROLE_BY_KEY,
  GET_ROLE_ASSIGNMENTS,
  GET_USER_BY_ID,
  REVOKE_ROLE_ASSIGNMENT,
} from '@/providers/role-assignment'
import { TransformRolesToAccessControl } from '@/utils/role-to-access-control'
import { auditPayload } from '@/utils/audit'
import { dbTransaction } from '@/utils/db-transaction'
import { GeneralError } from '@/utils/general-error'

/*
 * Role-assignment business logic (SPEC §8.3 / Task 16).
 * Beyond the route's `requiredScope({central, 'prayer_role_assignment', action})`
 * gate, the controller verifies the action-scope ceiling within the matching
 * role: the actor may never grant a role whose permission set exceeds their own.
 * Revocation is a soft `revoked_at` update, never a row delete.
 */

const notFound = (error_code: string) =>
  new GeneralError({
    code: 404,
    error: 'NOT_FOUND',
    error_code,
    details: 'Resource not found.',
  })

/** True if any of the actor's roles grants `subject` + `action` (ANY or OWN). */
const holdsGrant = (roles: RoleDataModel[], subject: string, action: string): boolean => {
  const ac = new AccessControl(TransformRolesToAccessControl({ roles }))
  return roles.some((r) => {
    const q = ac.can(r.name) as unknown as Record<string, (s: string) => { granted: boolean }>
    return Boolean(q[`${action}Any`](subject).granted || q[`${action}Own`](subject).granted)
  })
}

export const listRoleAssignments = async ({
  page,
  limit,
  order_direction,
}: {
  page: number
  limit: number
  order_direction: 'asc' | 'desc'
}) => GET_ROLE_ASSIGNMENTS({ page, limit, order_direction })

export const createRoleAssignment = async ({
  payload,
  actorId,
  requestId,
}: {
  payload: RoleAssignmentCreate
  actorId: string
  requestId: string
}) => {
  const role = await GET_ROLE_BY_KEY({ roleKey: payload.roleKey })
  if (!role) throw notFound('ROLE_NOT_FOUND')

  const user = await GET_USER_BY_ID({ userId: payload.userId })
  if (!user) throw notFound('USER_NOT_FOUND')

  const node = await GET_ORG_NODE_BY_ID({ orgNodeId: payload.orgNodeId })
  if (!node) throw notFound('ORG_NODE_NOT_FOUND')

  const existing = await GET_ACTIVE_ASSIGNMENT({
    userId: payload.userId,
    roleId: role.id,
    orgNodeId: payload.orgNodeId,
  })
  if (existing) {
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'DUPLICATE_ASSIGNMENT',
      details: 'The user already holds this active assignment.',
    })
  }

  // Privilege-escalation ceiling: the actor must hold EVERY grant the target role grants.
  const actorData = await GET_USER_SCOPE_DATA({ userId: actorId })
  const escalation = role.permission.find((p) => !holdsGrant(actorData.roles, p.subject, p.actions))
  if (escalation) {
    throw new GeneralError({
      code: 403,
      error: 'UNAUTHORIZED',
      error_code: 'ESCALATION_DENIED',
      details: `Cannot grant '${escalation.subject}' — this role is above the actor's own ceiling.`,
    })
  }

  const assignment = await dbTransaction(async (tx) => {
    const created = await CREATE_ROLE_ASSIGNMENT(
      {
        userId: payload.userId,
        roleId: role.id,
        orgNodeId: payload.orgNodeId,
        grantedBy: actorId,
      },
      tx,
    )
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'role_assignment.create',
        resourceType: 'role_assignment',
        resourceId: created.id,
        outcome: 'success',
        requestId,
      }),
    })
    return created
  })

  const summary: RoleAssignmentSummary = {
    id: assignment.id,
    user_id: user.id,
    user_email: user.email,
    user_name: user.name,
    role_id: role.id,
    role_key: role.name,
    org_node_id: node.id,
    org_node_name: node.name,
    granted_by: actorId,
    created_at: assignment.created_at.toISOString(),
    revoked_at: null,
  }
  return summary
}

export const revokeRoleAssignment = async ({
  assignmentId,
  actorId,
  requestId,
}: {
  assignmentId: string
  actorId: string
  requestId: string
}) => {
  const assignment = await GET_ASSIGNMENT_BY_ID({ assignmentId })
  if (!assignment || assignment.revoked_at) throw notFound('ASSIGNMENT_NOT_FOUND')

  const revoked = await dbTransaction(async (tx) => {
    const updated = await REVOKE_ROLE_ASSIGNMENT({ assignmentId, revokedAt: new Date() }, tx)
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'role_assignment.revoke',
        resourceType: 'role_assignment',
        resourceId: updated.id,
        outcome: 'success',
        requestId,
      }),
    })
    return updated
  })

  const summary: RoleAssignmentSummary = {
    id: revoked.id,
    user_id: assignment.user_id,
    user_email: assignment.user.email,
    user_name: assignment.user.name,
    role_id: assignment.role_id,
    role_key: assignment.role.name,
    org_node_id: assignment.org_node_id,
    org_node_name: assignment.org_node.name,
    granted_by: assignment.granted_by,
    created_at: assignment.created_at.toISOString(),
    revoked_at: revoked.revoked_at?.toISOString() ?? null,
  }
  return summary
}
