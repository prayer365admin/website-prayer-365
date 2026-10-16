// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/db-transaction', () => ({
  dbTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ auditLog: { create: vi.fn() } }),
  ),
}))

vi.mock('@/providers/role-assignment', () => ({
  CREATE_ROLE_ASSIGNMENT: vi.fn(),
  GET_ACTIVE_ASSIGNMENT: vi.fn(),
  GET_ASSIGNMENT_BY_ID: vi.fn(),
  GET_ORG_NODE_BY_ID: vi.fn(),
  GET_ROLE_BY_KEY: vi.fn(),
  GET_ROLE_ASSIGNMENTS: vi.fn(),
  GET_USER_BY_ID: vi.fn(),
  REVOKE_ROLE_ASSIGNMENT: vi.fn(),
}))

vi.mock('@/providers/scope', () => ({
  GET_USER_SCOPE_DATA: vi.fn(),
}))

import { createRoleAssignment, listRoleAssignments, revokeRoleAssignment } from './role-assignment'
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
import { GET_USER_SCOPE_DATA } from '@/providers/scope'

// DB permission rows carry ONE action each (expanded by the seed), matching
// the exact shape AccessControl consumes.
const FULL_ROLE = [
  { subject: 'prayer_role_assignment', actions: 'read', scope: 'ANY' },
  { subject: 'prayer_role_assignment', actions: 'create', scope: 'ANY' },
  { subject: 'prayer_role_assignment', actions: 'delete', scope: 'ANY' },
  { subject: 'prayer_church', actions: 'read', scope: 'ANY' },
  { subject: 'prayer_church', actions: 'update', scope: 'ANY' },
]

const CHURCH_ROLE = [
  { subject: 'prayer_church', actions: 'read', scope: 'ANY' },
  { subject: 'prayer_church', actions: 'update', scope: 'ANY' },
]

const adminGrantingRole = {
  id: 'r_admin',
  name: 'prayer_global_admin',
  permission: FULL_ROLE,
}

const actorFullRoles = [
  {
    id: 'r_actor',
    name: 'prayer_global_admin',
    permission: FULL_ROLE,
  },
]

const limitedActorRoles = [
  {
    id: 'r_limited',
    name: 'prayer_church_admin',
    permission: CHURCH_ROLE,
  },
]

const node = { id: 'n1', name: 'Estonia', kind: 'COUNTRY' }
const user = { id: 'u2', email: 'x@y.com', name: 'X', role: { name: 'prayer_administrator' } }

describe('listRoleAssignments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('delegates to the provider', async () => {
    vi.mocked(GET_ROLE_ASSIGNMENTS).mockResolvedValue({ total: 1, result: [{ id: 'a1' }] } as never)
    await expect(
      listRoleAssignments({ page: 1, limit: 25, order_direction: 'desc' }),
    ).resolves.toEqual({ total: 1, result: [{ id: 'a1' }] })
    expect(GET_ROLE_ASSIGNMENTS).toHaveBeenCalledWith({
      page: 1,
      limit: 25,
      order_direction: 'desc',
    })
  })
})

describe('createRoleAssignment', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['prayer_user', { name: 'prayer_user' }],
    ['no role', null],
  ])('refuses an assignment on a customer (%s) with USER_IS_CUSTOMER (R-02)', async (_l, role) => {
    vi.mocked(GET_ROLE_BY_KEY).mockResolvedValue(adminGrantingRole as never)
    vi.mocked(GET_USER_BY_ID).mockResolvedValue({ ...user, role } as never)

    await expect(
      createRoleAssignment({
        payload: { userId: 'u2', roleKey: 'prayer_global_admin', orgNodeId: 'n1' },
        actorId: 'actor',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'USER_IS_CUSTOMER' })
    expect(CREATE_ROLE_ASSIGNMENT).not.toHaveBeenCalled()
  })

  it('rejects privilege escalation (403) when actor lacks a grant the target role has', async () => {
    vi.mocked(GET_ROLE_BY_KEY).mockResolvedValue(adminGrantingRole as never)
    vi.mocked(GET_USER_BY_ID).mockResolvedValue(user as never)
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(node as never)
    vi.mocked(GET_ACTIVE_ASSIGNMENT).mockResolvedValue(null as never)
    vi.mocked(GET_USER_SCOPE_DATA).mockResolvedValue({ roles: limitedActorRoles } as never)

    await expect(
      createRoleAssignment({
        payload: { userId: 'u2', roleKey: 'prayer_global_admin', orgNodeId: 'n1' },
        actorId: 'actor',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 403, error_code: 'ESCALATION_DENIED' })
    expect(CREATE_ROLE_ASSIGNMENT).not.toHaveBeenCalled()
  })

  it('creates when the actor holds every grant of the target role', async () => {
    vi.mocked(GET_ROLE_BY_KEY).mockResolvedValue(adminGrantingRole as never)
    vi.mocked(GET_USER_BY_ID).mockResolvedValue(user as never)
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(node as never)
    vi.mocked(GET_ACTIVE_ASSIGNMENT).mockResolvedValue(null as never)
    vi.mocked(GET_USER_SCOPE_DATA).mockResolvedValue({ roles: actorFullRoles } as never)
    vi.mocked(CREATE_ROLE_ASSIGNMENT).mockResolvedValue({
      id: 'a1',
      created_at: new Date('2026-01-01'),
    } as never)

    const out = await createRoleAssignment({
      payload: { userId: 'u2', roleKey: 'prayer_global_admin', orgNodeId: 'n1' },
      actorId: 'actor',
      requestId: 'r',
    })
    expect(CREATE_ROLE_ASSIGNMENT).toHaveBeenCalled()
    expect(out).toMatchObject({ id: 'a1', user_id: 'u2', role_key: 'prayer_global_admin' })
  })

  it('rejects a duplicate active assignment (409)', async () => {
    vi.mocked(GET_ROLE_BY_KEY).mockResolvedValue(adminGrantingRole as never)
    vi.mocked(GET_USER_BY_ID).mockResolvedValue(user as never)
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(node as never)
    vi.mocked(GET_ACTIVE_ASSIGNMENT).mockResolvedValue({ id: 'existing' } as never)

    await expect(
      createRoleAssignment({
        payload: { userId: 'u2', roleKey: 'prayer_global_admin', orgNodeId: 'n1' },
        actorId: 'actor',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'DUPLICATE_ASSIGNMENT' })
  })
})

describe('revokeRoleAssignment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('revokes softly — updates revoked_at, never a row delete', async () => {
    vi.mocked(GET_ASSIGNMENT_BY_ID).mockResolvedValue({
      id: 'a1',
      user_id: 'u2',
      role_id: 'r_admin',
      role: { name: 'prayer_global_admin' },
      org_node_id: 'n1',
      org_node: { name: 'Estonia' },
      user: { email: 'x@y.com', name: 'X' },
      granted_by: 'actor',
      created_at: new Date('2026-01-01'),
      revoked_at: null,
    } as never)
    vi.mocked(REVOKE_ROLE_ASSIGNMENT).mockResolvedValue({
      id: 'a1',
      revoked_at: new Date('2026-02-01'),
    } as never)

    const out = await revokeRoleAssignment({ assignmentId: 'a1', actorId: 'actor', requestId: 'r' })

    expect(REVOKE_ROLE_ASSIGNMENT).toHaveBeenCalledWith(
      { assignmentId: 'a1', revokedAt: expect.any(Date) },
      expect.anything(),
    )
    expect(out.revoked_at).not.toBeNull()
  })

  it('returns 404 when the assignment is missing or already revoked', async () => {
    vi.mocked(GET_ASSIGNMENT_BY_ID).mockResolvedValue(null as never)
    await expect(
      revokeRoleAssignment({ assignmentId: 'nope', actorId: 'actor', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 404, error_code: 'ASSIGNMENT_NOT_FOUND' })
  })
})
