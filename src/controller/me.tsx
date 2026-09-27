import { GET_ME } from '@/providers/user'
import { MeInput } from '@/models/me'
import { GeneralError } from '@/utils/general-error'

/*
 * GET /api/v1/admin/me (Task 9).
 * Safe identity + accessible scopes from active role assignments.
 * Controller owns validation; provider owns the DB read.
 */
export const getMe = async ({ user_id }: MeInput) => {
  if (!user_id) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_USER_ID',
      details: 'Provide a valid user ID.',
    })
  }

  const result = await GET_ME({ user_id })

  if (!result) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'USER_NOT_FOUND',
      details: 'User not found.',
    })
  }

  return result
}
