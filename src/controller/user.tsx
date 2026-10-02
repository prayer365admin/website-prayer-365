import { UserPayloadCreateModel, UserPayloadUpdateModel } from '@/models/user'
import {
  CREATE_USER,
  GET_USER_BY_EMAIL,
  GET_USER_BY_ID,
  INCREMENT_AUTH_VERSION,
  UPDATE_USER,
} from '@/providers/user'
import { GeneralError } from '@/utils/general-error'
import { hashSecret } from '@/utils/hash'

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
 * Bind the user's single role (identity/RBAC). role_assignments are managed
 * separately via /admin/central/role-assignments for org-scoping.
 */
export const createUser = async ({ email, name, password, role_id }: UserPayloadCreateModel) => {
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
  })
  return result
}

export const updateUser = async ({
  user_id,
  payload,
}: {
  user_id: string
  payload: UserPayloadUpdateModel
}) => {
  const { role_id, password, name, email_verified_at, profile_picture } = payload

  const safePayload: {
    name?: string
    password?: string
    email_verified_at?: Date | null
    profile_picture?: string | null
    role_id?: string | null
  } = {}
  if (name !== undefined) safePayload.name = name as string
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
  return result
}
