import {
  FIND_OR_CREATE_OAUTH_CUSTOMER,
  GET_USER_BY_EMAIL,
  GET_USER_BY_OAUTH_ACCOUNT,
} from '@/providers/user'
import { verifySecret } from '@/utils/hash'
import { CredentialsSignin } from 'next-auth'

class SigningError extends CredentialsSignin {
  constructor(code: string) {
    super()
    this.code = code
  }
}

export const loginUser = async ({ email, password }: { email: string; password: string }) => {
  const result = await GET_USER_BY_EMAIL({ email: email })

  if (!result) {
    throw new SigningError('USER_NOT_FOUND')
  }

  const resultPassword = result?.password

  if (!password) {
    throw new SigningError('PASSWORD_INVALID')
  }

  if (!resultPassword) {
    throw new SigningError('ACCOUNT_HAS_NO_PASSWORD')
  }

  const isVerify = await verifySecret({ secret: password, hashedSecret: resultPassword })

  if (!isVerify) {
    throw new SigningError('PASSWORD_INVALID')
  }

  if (!result.email_verified_at) {
    throw new SigningError('EMAIL_NOT_VERIFIED')
  }

  return result
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
