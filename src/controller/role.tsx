import { RolePayloadCreateInput, RolePayloadUpdateInput } from '@/models/role'
import { ADMINISTRATOR_ROLE } from '@/utils/constant'
import { auditPayload } from '@/utils/audit'
import { dbTransaction } from '@/utils/db-transaction'
import { GeneralError } from '@/utils/general-error'
import {
  COUNT_ROLE_USAGE,
  CREATE_ROLE,
  DELETE_ROLE,
  GET_ROLE_BY_ID,
  GET_ROLE_BY_NAME,
  UPDATE_ROLE,
} from '@/providers/role'

/*
 * Role management (plan 023). The routes were disabled with "roles are managed via
 * role assignments", which left the dashboard's Role create/edit/delete screens
 * dead. They are enabled again with the guards that keep the platform safe:
 *
 * - `administrator` is immutable: it is the super-admin role and must keep EVERY
 *   permission row, otherwise a single edit can lock the platform out.
 * - a SYSTEM role keeps its name (the seed and the code reference those names).
 * - a role still bound to a user or an assignment cannot be deleted.
 * Every mutation writes an audit row in the same transaction.
 */

const conflict = (error_code: string, details: string, fields?: Record<string, string>) =>
  new GeneralError({ code: 409, error: 'CONFLICT', error_code, details, fields })

const notFound = () =>
  new GeneralError({
    code: 404,
    error: 'NOT_FOUND',
    error_code: 'ROLE_NOT_FOUND',
    details: 'Role not found.',
  })

const locked = (details: string) =>
  new GeneralError({ code: 403, error: 'FORBIDDEN', error_code: 'ROLE_LOCKED', details })

export const createRole = async ({
  payload,
  actorId,
  requestId,
}: {
  payload: RolePayloadCreateInput
  actorId: string
  requestId: string
}) => {
  const name = payload.name?.trim()
  if (!name) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'ROLE_NAME_REQUIRED',
      details: 'A role name is required.',
    })
  }
  if (name === ADMINISTRATOR_ROLE) throw locked('The super-admin role already exists.')
  if (await GET_ROLE_BY_NAME({ name })) throw conflict('ROLE_EXISTS', 'That role name is taken.')

  const permission_list = payload.permission_list ?? {}
  const connect = Object.keys(permission_list).filter((id) => permission_list[id])

  return dbTransaction(async (tx) => {
    const created = await CREATE_ROLE(
      {
        name,
        // A dashboard-created role is never a SYSTEM role; SYSTEM names carry
        // meaning for the seed and for the code.
        type: 'USER',
        permission: { connect: connect.map((id) => ({ id })) },
      },
      tx,
    )
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'role.create',
        resourceType: 'role',
        resourceId: created.id,
        outcome: 'success',
        requestId,
      }),
    })
    return created
  })
}

export const updateRole = async ({
  role_id,
  payload,
  actorId,
  requestId,
}: {
  role_id: string
  payload: RolePayloadUpdateInput
  actorId: string
  requestId: string
}) => {
  const existing = await GET_ROLE_BY_ID({ role_id })
  if (!existing) throw notFound()
  if (existing.name === ADMINISTRATOR_ROLE)
    throw locked('The super-admin role keeps every permission and cannot be edited.')

  const name = (payload.name ?? existing.name).trim()
  if (!name) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'ROLE_NAME_REQUIRED',
      details: 'A role name is required.',
    })
  }
  if (name !== existing.name && existing.type === 'SYSTEM')
    throw conflict('SYSTEM_ROLE_RENAME', 'A system role keeps its name.')
  if (name !== existing.name && (await GET_ROLE_BY_NAME({ name })))
    throw conflict('ROLE_EXISTS', 'That role name is taken.')

  return dbTransaction(async (tx) => {
    const updated = await UPDATE_ROLE(
      {
        role_id,
        name,
        type: existing.type,
        permission_list: payload.permission_list ?? {},
      },
      tx,
    )
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'role.update',
        resourceType: 'role',
        resourceId: role_id,
        outcome: 'success',
        requestId,
      }),
    })
    return updated
  })
}

export const deleteRole = async ({
  role_id,
  actorId,
  requestId,
}: {
  role_id: string
  actorId: string
  requestId: string
}) => {
  const existing = await GET_ROLE_BY_ID({ role_id })
  if (!existing) throw notFound()
  if (existing.name === ADMINISTRATOR_ROLE) throw locked('The super-admin role cannot be deleted.')
  if (existing.type === 'SYSTEM') throw conflict('SYSTEM_ROLE', 'System roles cannot be deleted.')

  const usage = await COUNT_ROLE_USAGE({ role_id })
  if (usage.users > 0 || usage.assignments > 0) {
    throw conflict(
      'ROLE_IN_USE',
      'Move the users and assignments off this role before deleting it.',
      { users: String(usage.users), assignments: String(usage.assignments) },
    )
  }

  return dbTransaction(async (tx) => {
    const removed = await DELETE_ROLE({ role_id }, tx)
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'role.delete',
        resourceType: 'role',
        resourceId: role_id,
        outcome: 'success',
        requestId,
      }),
    })
    return removed
  })
}
