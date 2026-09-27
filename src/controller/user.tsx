import { UserPayloadCreateModel, UserPayloadUpdateModel } from '@/models/user'
import { CREATE_USER, GET_USER_BY_EMAIL, GET_USER_BY_ID, UPDATE_USER } from '@/providers/user'
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
    role_id: role_id,
    email_verified_at: new Date(),
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
  if (payload.password) {
    payload.password = await hashSecret({ secret: `${payload.password}` })
  } else {
    delete payload.password
  }
  const result = await UPDATE_USER({
    user_id: user_id,
    payload: payload,
  })
  return result
}
