import { z } from 'zod'

/*
 * Central role-assignment DTOs (SPEC §8.3 / Task 16).
 * Assignments are scoped (userId + roleKey + orgNodeId) and revoked softly
 * via `revoked_at`; they are never hard-deleted.
 */

export const RoleAssignmentCreateSchema = z.object({
  userId: z.string().min(1),
  roleKey: z.string().min(1),
  orgNodeId: z.string().min(1),
})
export type RoleAssignmentCreate = z.infer<typeof RoleAssignmentCreateSchema>

export const RoleAssignmentIdSchema = z.object({
  assignmentId: z.string().min(1),
})
export type RoleAssignmentId = z.infer<typeof RoleAssignmentIdSchema>

export interface RoleAssignmentSummary {
  id: string
  user_id: string
  user_email: string
  user_name: string
  role_id: string
  role_key: string
  org_node_id: string
  org_node_name: string
  granted_by: string
  created_at: string
  revoked_at: string | null
}
