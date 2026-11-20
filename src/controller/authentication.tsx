import {
  FIND_OR_CREATE_OAUTH_CUSTOMER,
  GET_USER_BY_EMAIL,
  GET_USER_BY_OAUTH_ACCOUNT,
  RECORD_LOGIN,
} from '@/providers/user'
import { verifySecret } from '@/utils/hash'
import { CANCEL_ACCOUNT_DELETION } from '@/providers/privacy-job'
import { CredentialsSignin } from 'next-auth'
import {
  CLEAR_LOGIN_FAILURES,
  IS_LOGIN_BLOCKED,
  RECORD_LOGIN_FAILURE,
} from '@/providers/auth-login-attempt'

class SigningError extends CredentialsSignin {
  constructor(code: string) {
    super()
    this.code = code
  }
}

export const loginUser = async ({ email, password }: { email: string; password: string }) => {
  const result = await GET_USER_BY_EMAIL({ email: email?.trim().toLowerCase() })
  const blocked = result ? await IS_LOGIN_BLOCKED({ user_id: result.id }) : false

  // Always perform one bcrypt comparison so unknown, disabled and OAuth-only
  // accounts have the same public error and broadly similar response timing.
  const isVerify = await verifySecret({
    secret: password || '',
    hashedSecret:
      result?.password ?? '$2b$12$6hmwy2T/qCvpmzmzi5VLO.KVXRoHDPmkRu.fO.soPraM/uY2msHo2',
  })

  // `deletion_pending` may still sign in: a correct password during the grace window cancels the
  // deletion (below). Any other non-active status stays refused.
  const pending = result?.status === 'deletion_pending'
  if (
    !result ||
    (result.status !== 'active' && !pending) ||
    !result.password ||
    !password ||
    !isVerify
  ) {
    if (result && !blocked) await RECORD_LOGIN_FAILURE({ user_id: result.id })
    throw new SigningError('INVALID_CREDENTIALS')
  }

  if (blocked) {
    throw new SigningError('INVALID_CREDENTIALS')
  }

  await CLEAR_LOGIN_FAILURES({ user_id: result.id })

  if (!result.email_verified_at) {
    throw new SigningError('EMAIL_NOT_VERIFIED')
  }

  if (pending) {
    // Same generic error as a wrong password when the erase already started (no leak).
    if (!(await CANCEL_ACCOUNT_DELETION({ userId: result.id }))) {
      throw new SigningError('INVALID_CREDENTIALS')
    }
  }

  await RECORD_LOGIN({ user_id: result.id, provider: 'password' })

  return pending ? { ...result, status: 'active' } : result
}

export const loginGoogleCustomer = ({
  providerAccountId,
  email,
  name,
  profilePicture,
}: {
  providerAccountId: string
  email: string
  name: string
  profilePicture: string | null
}) =>
  FIND_OR_CREATE_OAUTH_CUSTOMER({
    provider: 'google',
    providerAccountId,
    email: email.trim().toLowerCase(),
    name: name.trim(),
    profilePicture,
  })

export const getOAuthUser = ({
  provider,
  providerAccountId,
}: {
  provider: string
  providerAccountId: string
}) => GET_USER_BY_OAUTH_ACCOUNT({ provider, providerAccountId })
