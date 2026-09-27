import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'

/*
 * Role-assignment provider (Task 16). Thin Prisma adapter; the controller
 * owns authorization (no escalation) and the transaction (assignment + audit).
 * Revocation is a soft update of `revoked_at`, never a row delete.
 */

export const GET_ROLE_BY_KEY = async ({ roleKey }: { roleKey: string }) =>
  db.role.findUnique({ where: { name: roleKey }, include: { permission: true } })

export const GET_USER_BY_ID = async ({ userId }: { userId: string }) =>
  db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  })

export const GET_ORG_NODE_BY_ID = async ({ orgNodeId }: { orgNodeId: string }) =>
  db.orgNode.findUnique({
    where: { id: orgNodeId },
    select: { id: true, name: true, kind: true },
  })

export const GET_ACTIVE_ASSIGNMENT = async ({
  userId,
  roleId,
  orgNodeId,
}: {
  userId: string
  roleId: string
  orgNodeId: string
}) =>
  db.roleAssignment.findFirst({
    where: { user_id: userId, role_id: roleId, org_node_id: orgNodeId, revoked_at: null },
  })

export const GET_ASSIGNMENT_BY_ID = async ({ assignmentId }: { assignmentId: string }) =>
  db.roleAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      role: { select: { name: true } },
      org_node: { select: { name: true } },
      user: { select: { email: true, name: true } },
    },
  })

export const GET_ROLE_ASSIGNMENTS = async ({
  page,
  limit,
  order_direction,
}: {
  page: number
  limit: number
  order_direction: 'asc' | 'desc'
}) => {
  const where: Prisma.RoleAssignmentWhereInput = { revoked_at: null }
  const [total, rows] = await db.$transaction([
    db.roleAssignment.count({ where }),
    db.roleAssignment.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { created_at: order_direction },
      include: {
        role: { select: { name: true } },
        org_node: { select: { name: true } },
        user: { select: { email: true, name: true } },
      },
    }),
  ])
  return {
    total,
    result: rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_email: r.user.email,
      user_name: r.user.name,
      role_id: r.role_id,
      role_key: r.role.name,
      org_node_id: r.org_node_id,
      org_node_name: r.org_node.name,
      granted_by: r.granted_by,
      created_at: r.created_at.toISOString(),
      revoked_at: r.revoked_at?.toISOString() ?? null,
    })),
  }
}

export const CREATE_ROLE_ASSIGNMENT = async (
  {
    userId,
    roleId,
    orgNodeId,
    grantedBy,
  }: { userId: string; roleId: string; orgNodeId: string; grantedBy: string },
  tx: Prisma.TransactionClient = db,
) =>
  tx.roleAssignment.create({
    data: { user_id: userId, role_id: roleId, org_node_id: orgNodeId, granted_by: grantedBy },
  })

export const REVOKE_ROLE_ASSIGNMENT = async (
  { assignmentId, revokedAt }: { assignmentId: string; revokedAt: Date },
  tx: Prisma.TransactionClient = db,
) => tx.roleAssignment.update({ where: { id: assignmentId }, data: { revoked_at: revokedAt } })
