import { UserPayloadCreateModel, UserPayloadUpdateModel } from '@/models/user'
import {
  CREATE_USER,
  COUNT_ACTIVE_CUSTOMERS,
  DEACTIVATE_USER,
  GET_USER_BY_EMAIL,
  GET_USER_BY_ID,
  INCREMENT_AUTH_VERSION,
  UPDATE_USER,
} from '@/providers/user'
import { COUNT_ACTIVE_ADMINS } from '@/providers/user'
import { dbTransaction } from '@/utils/db-transaction'
import { auditPayload } from '@/utils/audit'
import { GET_ACTIVE_ASSIGNMENT, GET_ROLE_BY_KEY } from '@/providers/role-assignment'
import { GET_GLOBAL_ORG_NODE } from '@/providers/scope'
import { createRoleAssignment } from './role-assignment'
import { ADMINISTRATOR_ROLE } from '@/utils/constant'
import { GeneralError } from '@/utils/general-error'
import { hashSecret } from '@/utils/hash'
import { logger } from '@/utils/logger'

export const getFellowshipMemberCount = (): Promise<number> => COUNT_ACTIVE_CUSTOMERS()

export const getUserById = async ({ user_id }: { user_id: string }) => {
  if (!user_id) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      details: 'Provide valid user ID!',
      error_code: 'INVALID_USER_ID',
    })
  }

  const result = await GET_USER_BY_ID({ user_id: user_id })

  if (!result) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'USER_NOT_FOUND',
      details: 'User not exists!',
    })
  }

  return result
}

export const getUserByEmail = async ({ email }: { email: string }) => {
  if (!email) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      details: 'Provide valid user email!',
      error_code: 'INVALID_USER_EMAIL',
    })
  }

  const result = await GET_USER_BY_EMAIL({ email: email })

  if (!result) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'USER_NOT_FOUND',
      details: 'User not exists!',
    })
  }

  return result
}

/**
 * A user bound to the `administrator` identity role also needs the TENANCY layer:
 * `requiredScope` authorizes from `role_assignments`, never from the identity role,
 * so an admin created in the dashboard would answer 403 (or see empty lists) on
 * every church/central route. The assignment is created through the audited
 * role-assignment controller and is idempotent. A failure here never rolls the
 * user back — the Scope Assignments card on the user page is the manual fallback.
 */
const ensureGlobalAdminAssignment = async ({
  userId,
  actorId,
  requestId,
}: {
  userId?: string
  actorId?: string
  requestId?: string
}) => {
  if (!userId) return
  const request = requestId ?? crypto.randomUUID()
  const user = await GET_USER_BY_ID({ user_id: userId })
  if (user?.role?.name !== ADMINISTRATOR_ROLE) return

  const [globalNode, role] = await Promise.all([
    GET_GLOBAL_ORG_NODE(),
    GET_ROLE_BY_KEY({ roleKey: ADMINISTRATOR_ROLE }),
  ])
  if (!globalNode || !role) {
    logger.error('admin_scope_assignment_skipped', {
      request_id: request,
      user_id: userId,
      error_message: 'GLOBAL org node or administrator role is missing',
    })
    return
  }

  const existing = await GET_ACTIVE_ASSIGNMENT({
    userId,
    roleId: role.id,
    orgNodeId: globalNode.id,
  })
  if (existing) return

  try {
    await createRoleAssignment({
      payload: { userId, roleKey: ADMINISTRATOR_ROLE, orgNodeId: globalNode.id },
      actorId: actorId ?? userId,
      requestId: request,
    })
  } catch (e) {
    const error = e as Error & { error_code?: string }
    logger.error('admin_scope_assignment_failed', {
      request_id: request,
      user_id: userId,
      error_code: error.error_code ?? 'UNKNOWN',
      error_name: error.name,
      error_message: error.message,
    })
  }
}

/**
 * Bind the user's single role (identity/RBAC) and, for the super-admin role, the
 * matching GLOBAL org assignment (tenancy/scoping). Other roles keep their
 * assignments managed via /admin/central/role-assignments.
 */
export const createUser = async ({
  email,
  name,
  password,
  role_id,
  profile_picture,
  actorId,
  requestId,
}: UserPayloadCreateModel & { actorId?: string; requestId?: string }) => {
  if (!password) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_PASSWORD',
      details: 'Password is invalid!',
    })
  }

  const passwordHash = await hashSecret({ secret: password })
  // Dashboard/admin-created users are auto-verified — no verification email needed.
  const result = await CREATE_USER({
    email,
    name: name,
    password: passwordHash,
    email_verified_at: new Date(),
    role_id,
    ...(profile_picture ? { profile_picture } : {}),
  })
  await ensureGlobalAdminAssignment({ userId: result?.id, actorId, requestId })
  return result
}

/**
 * Soft delete (plan 023): a staff account is DEACTIVATED, never row-deleted, so
 * donations, requests, assignments and audit history keep their author. Both
 * guards and the login path reject a non-active user, and the auth-version bump
 * ends every live cookie/refresh token.
 */
export const deactivateUser = async ({
  user_id,
  actorId,
  requestId,
}: {
  user_id: string
  actorId: string
  requestId: string
}) => {
  const target = await GET_USER_BY_ID({ user_id })
  if (!target) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'USER_NOT_FOUND',
      details: 'User not found.',
    })
  }
  if (user_id === actorId) {
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'CANNOT_DEACTIVATE_SELF',
      details: 'You cannot deactivate your own account.',
    })
  }
  if (target.status !== 'active' || target.deleted_at) {
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'ALREADY_INACTIVE',
      details: 'This account is already deactivated.',
    })
  }
  if (target.role?.name === ADMINISTRATOR_ROLE) {
    const otherAdmins = await COUNT_ACTIVE_ADMINS({ excludeUserId: user_id })
    if (otherAdmins === 0) {
      throw new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'LAST_ADMIN',
        details: 'The last active super admin cannot be deactivated.',
      })
    }
  }

  return dbTransaction(async (tx) => {
    const updated = await DEACTIVATE_USER({ user_id }, tx)
    await INCREMENT_AUTH_VERSION({ user_id }, tx)
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'user.deactivate',
        resourceType: 'user',
        resourceId: user_id,
        outcome: 'success',
        requestId,
      }),
    })
    return updated
  })
}

export const updateUser = async ({
  user_id,
  payload,
  actorId,
  requestId,
}: {
  user_id: string
  payload: UserPayloadUpdateModel
  actorId?: string
  requestId?: string
}) => {
  const { role_id, password, name, email, email_verified_at, profile_picture } = payload

  const safePayload: {
    name?: string
    email?: string
    password?: string
    email_verified_at?: Date | null
    profile_picture?: string | null
    role_id?: string | null
  } = {}
  if (name !== undefined) safePayload.name = name as string
  if (email !== undefined) safePayload.email = email as string

  if (role_id !== undefined) safePayload.role_id = role_id as string
  if (email_verified_at !== undefined)
    safePayload.email_verified_at = email_verified_at as Date | null
  if (profile_picture !== undefined) safePayload.profile_picture = profile_picture as string | null
  if (password) {
    safePayload.password = await hashSecret({ secret: `${password}` })
    // D1 (plan 002): any password change invalidates outstanding mobile tokens.
    await INCREMENT_AUTH_VERSION({ user_id })
  }

  const result = await UPDATE_USER({ user_id: user_id, payload: safePayload })
  // Promote/demote into the super-admin role also reconciles the tenancy layer.
  if (role_id !== undefined)
    await ensureGlobalAdminAssignment({ userId: user_id, actorId, requestId })
  return result
}
