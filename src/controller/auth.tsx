import sendMail from '@/controller/mail'
import { GeneralError } from '@/utils/general-error'
import { hashSecret } from '@/utils/hash'
import { AuthTokenType } from '@prisma/client'
import dayjs from 'dayjs'
import {
  CREATE_AUTH_TOKEN,
  GET_LATEST_AUTH_TOKEN,
  GET_VALID_AUTH_TOKEN,
  USE_AUTH_TOKEN,
} from '@/providers/auth-token'
import {
  CREATE_USER,
  GET_USER_BY_EMAIL,
  GET_USER_BY_ROLE_TYPE,
  UPDATE_USER,
} from '@/providers/user'
import { updateUser } from '@/controller/user'

const EMAIL_REGEX = /^\S+@\S+\.\S+$/
const MIN_PASSWORD_LENGTH = 8
const VERIFICATION_TTL_MINUTES = 1440

const getCooldownSeconds = () => Number(process.env.VERIFY_RESEND_COOLDOWN_SECONDS) || 90

const sendVerificationEmail = async ({
  user_id,
  email,
  name,
  baseUrl,
}: {
  user_id: string
  email: string
  name: string
  baseUrl: string
}) => {
  const createdToken = await CREATE_AUTH_TOKEN({
    user_id: user_id,
    type: AuthTokenType.EMAIL_VERIFICATION,
    ttl_minutes: VERIFICATION_TTL_MINUTES,
  })

  await sendMail({
    from: process.env.MAIL_FROM || 'info@example.com',
    to: email,
    subject: 'Verify your email',
    template_name: 'verify-email',
    payload: {
      customerName: name,
      link: `${baseUrl}/verify-email?token=${createdToken.token}`,
      companyName: process.env.NEXT_PUBLIC_COMPANY_NAME,
      currentYear: dayjs().year(),
    },
    baseUrl: baseUrl,
  })
}

export const registerUser = async ({
  full_name,
  email,
  password,
  baseUrl,
}: {
  full_name: string
  email: string
  password: string
  baseUrl: string
}) => {
  const name = full_name?.trim()
  const emailNormalized = email?.trim().toLowerCase()

  if (!name) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_FULL_NAME',
      details: 'Full name is required!',
    })
  }

  if (!EMAIL_REGEX.test(emailNormalized || '')) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_EMAIL',
      details: 'Email is invalid!',
    })
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_PASSWORD',
      details: `Password must be at least ${MIN_PASSWORD_LENGTH} characters!`,
    })
  }

  const existingUser = await GET_USER_BY_EMAIL({ email: emailNormalized })

  if (existingUser) {
    // Same response whether the account is verified or not — no enumeration.
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'USER_EXISTS',
      details: 'User already exists!',
    })
  }

  const role =
    (await GET_USER_BY_ROLE_TYPE({ type: 'USER', name: 'member' })) ||
    (await GET_USER_BY_ROLE_TYPE({ type: 'USER' }))

  if (!role) {
    throw new GeneralError({
      code: 500,
      error: 'INTERNAL_SERVER_ERROR',
      error_code: 'DEFAULT_ROLE_NOT_FOUND',
      details: 'Default signup role is not configured!',
    })
  }

  const passwordHash = await hashSecret({ secret: password })

  const result = await CREATE_USER({
    email: emailNormalized,
    name: name,
    password: passwordHash,
    role_id: role.id,
  })

  await sendVerificationEmail({
    user_id: result.id,
    email: emailNormalized,
    name: name,
    baseUrl: baseUrl,
  })

  return { id: result.id, email: result.email, name: result.name }
}

export const verifyEmail = async ({ token }: { token: string }) => {
  if (!token) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_TOKEN',
      details: 'Token is required!',
    })
  }

  const authToken = await GET_VALID_AUTH_TOKEN({
    token: token,
    type: AuthTokenType.EMAIL_VERIFICATION,
  })

  if (!authToken) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_OR_EXPIRED',
      details: 'Verification link is invalid or expired!',
    })
  }

  await USE_AUTH_TOKEN({ id: authToken.id })

  await UPDATE_USER({
    user_id: authToken.user_id,
    payload: { email_verified_at: new Date() },
  })

  return { success: true }
}

export const resendVerificationEmail = async ({
  email,
  baseUrl,
}: {
  email: string
  baseUrl: string
}) => {
  const emailNormalized = email?.trim().toLowerCase()
  const cooldownSeconds = getCooldownSeconds()

  if (!EMAIL_REGEX.test(emailNormalized || '')) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_EMAIL',
      details: 'Email is invalid!',
    })
  }

  const user = await GET_USER_BY_EMAIL({ email: emailNormalized })

  // Soft success for unknown emails — no account enumeration via this endpoint.
  if (!user) {
    return { cooldown_seconds: cooldownSeconds }
  }

  if (user.email_verified_at) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'ALREADY_VERIFIED',
      details: 'Email is already verified!',
    })
  }

  const latestToken = await GET_LATEST_AUTH_TOKEN({
    user_id: user.id,
    type: AuthTokenType.EMAIL_VERIFICATION,
  })

  if (latestToken) {
    const elapsedSeconds = Math.floor(
      (Date.now() - new Date(latestToken.created_at).getTime()) / 1000,
    )
    const remainingSeconds = cooldownSeconds - elapsedSeconds

    if (remainingSeconds > 0) {
      throw new GeneralError({
        code: 429,
        error: 'TOO_MANY_REQUESTS',
        error_code: 'RESEND_TOO_EARLY',
        details: `Please wait ${remainingSeconds} seconds before resending (remaining_seconds=${remainingSeconds})!`,
      })
    }
  }

  await sendVerificationEmail({
    user_id: user.id,
    email: user.email,
    name: user.name,
    baseUrl: baseUrl,
  })

  return { cooldown_seconds: cooldownSeconds }
}

const RESET_TTL_MINUTES = 30

export const requestPasswordReset = async ({
  email,
  baseUrl,
}: {
  email: string
  baseUrl: string
}) => {
  const emailNormalized = email?.trim().toLowerCase()

  if (!EMAIL_REGEX.test(emailNormalized || '')) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_EMAIL',
      details: 'Email is invalid!',
    })
  }

  const user = await GET_USER_BY_EMAIL({ email: emailNormalized })

  // Soft success for unknown emails — no account enumeration via this endpoint.
  if (!user) {
    return { success: true }
  }

  const createdToken = await CREATE_AUTH_TOKEN({
    user_id: user.id,
    type: AuthTokenType.PASSWORD_RESET,
    ttl_minutes: RESET_TTL_MINUTES,
  })

  await sendMail({
    from: process.env.MAIL_FROM || 'info@example.com',
    to: user.email,
    subject: 'Reset Your Password',
    template_name: 'forgot-password',
    payload: {
      customerName: user.name,
      link: `${baseUrl}/reset-password?token=${createdToken.token}`,
      companyName: process.env.NEXT_PUBLIC_COMPANY_NAME,
      currentYear: dayjs().year(),
    },
    baseUrl: baseUrl,
  })

  return { success: true }
}

export const resetPassword = async ({
  token,
  new_password,
}: {
  token: string
  new_password: string
}) => {
  if (!token) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_TOKEN',
      details: 'Reset token is required!',
    })
  }

  if (!new_password || new_password.length < MIN_PASSWORD_LENGTH) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_PASSWORD',
      details: `Password must be at least ${MIN_PASSWORD_LENGTH} characters!`,
    })
  }

  const authToken = await GET_VALID_AUTH_TOKEN({
    token: token,
    type: AuthTokenType.PASSWORD_RESET,
  })

  if (!authToken) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_OR_EXPIRED_TOKEN',
      details: 'Reset link is invalid or expired!',
    })
  }

  await USE_AUTH_TOKEN({ id: authToken.id })

  await updateUser({
    user_id: authToken.user_id,
    payload: { password: new_password },
  })

  return { success: true }
}
