import { randomUUID } from 'crypto'
import { CredentialsSignin } from 'next-auth'
import { GeneralError } from '@/utils/general-error'
import { loginUser } from '@/controller/authentication'
import { GET_USER_BY_ID } from '@/providers/user'
import {
  CREATE_MOBILE_SESSION,
  GET_MOBILE_SESSION_BY_HASH,
  REVOKE_MOBILE_SESSION,
  REVOKE_SESSION_FAMILY,
  ROTATE_MOBILE_SESSION,
} from '@/providers/mobile-auth'
import { hashRefreshToken, randomRefreshToken, signMobileAccessToken } from '@/utils/jwt-token'
import { db } from '@/utils/db-connection'
import type { MobileTokenResponse } from '@/models/mobile-auth'

/*
 * D1 mobile token contract controller (SPEC §3.1 / plan 002).
 *
 * OWNER of all token business logic. Providers are raw DB only. Flow:
 *   login   → verify password (reuse loginUser) + issue access JWT (15 min) +
 *             rotate-able hashed refresh token bound to (user, installation).
 *   refresh → single-use rotation; a REUSED token (already used_at) = theft →
 *             revoke whole `family_id`. Rejects expired/revoked/missing tokens
 *             and mismatched `auth_version` / inactive users.
 *   logout  → revoke the device session.
 */

const ACCESS_TTL_SECONDS = 15 * 60
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000

const unauthorized = () =>
  new GeneralError({
    code: 401,
    error: 'Not Authenticated!',
    error_code: 'UNAUTHORIZED',
    details: 'Invalid or expired credentials.',
  })

// ---- login ----------------------------------------------------------------

export const mobileLogin = async ({
  email,
  password,
  installationId,
}: {
  email: string
  password: string
  installationId: string
}): Promise<MobileTokenResponse> => {
  let user: Awaited<ReturnType<typeof loginUser>>
  try {
    user = await loginUser({ email, password })
  } catch (e) {
    if (e instanceof CredentialsSignin) {
      // Generic failure — no account-existence leak (same 401 for a known vs unknown email).
      throw unauthorized()
    }
    throw e
  }

  const role = user.role ? { id: user.role.id, name: user.role.name } : { id: '', name: '' }
  const familyId = randomUUID()
  const refreshToken = randomRefreshToken()

  await CREATE_MOBILE_SESSION({
    user_id: user.id,
    token_hash: hashRefreshToken(refreshToken),
    installation_id: installationId,
    family_id: familyId,
    expires_at: new Date(Date.now() + REFRESH_TTL_MS),
    auth_version: user.auth_version,
  })

  const accessToken = await signMobileAccessToken({
    user_id: user.id,
    email: user.email,
    name: user.name,
    role,
    auth_version: user.auth_version,
  })

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TTL_SECONDS,
    user: { id: user.id, email: user.email, name: user.name, authVersion: user.auth_version },
  }
}

// ---- refresh --------------------------------------------------------------

export const mobileRefresh = async ({
  refreshToken,
  installationId,
}: {
  refreshToken: string
  installationId: string
}): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
}> => {
  const presented = await GET_MOBILE_SESSION_BY_HASH({ token_hash: hashRefreshToken(refreshToken) })
  if (!presented) throw unauthorized()

  // Reuse detection: a presented token already used once was either replayed
  // (stolen) or is an out-of-date entry from an earlier rotation → revoke whole family.
  if (presented.used_at) {
    await REVOKE_SESSION_FAMILY({ family_id: presented.family_id! })
    throw unauthorized()
  }

  if (presented.revoked_at) throw unauthorized()
  if (presented.expires_at.getTime() <= Date.now()) throw unauthorized()

  // Authorization-bound checks: reject missing / inactive users and tokens
  // minted before a password change / account disable.
  const user = await GET_USER_BY_ID({ user_id: presented.user_id })
  if (!user || user.status !== 'active') {
    await REVOKE_SESSION_FAMILY({ family_id: presented.family_id! })
    throw unauthorized()
  }
  if (user.auth_version !== presented.auth_version) {
    await REVOKE_SESSION_FAMILY({ family_id: presented.family_id! })
    throw unauthorized()
  }

  const role = user.role ? { id: user.role.id, name: user.role.name } : { id: '', name: '' }
  const nextRefresh = randomRefreshToken()

  await db.$transaction((tx) =>
    ROTATE_MOBILE_SESSION({
      presented_id: presented.id,
      user_id: user.id,
      token_hash: hashRefreshToken(nextRefresh),
      installation_id: installationId,
      family_id: presented.family_id!,
      auth_version: user.auth_version,
      new_expires_at: new Date(Date.now() + REFRESH_TTL_MS),
      tx,
    }),
  )

  const accessToken = await signMobileAccessToken({
    user_id: user.id,
    email: user.email,
    name: user.name,
    role,
    auth_version: user.auth_version,
  })

  return { accessToken, refreshToken: nextRefresh, expiresIn: ACCESS_TTL_SECONDS }
}

// ---- logout ---------------------------------------------------------------

export const mobileLogout = async ({ refreshToken }: { refreshToken: string }) => {
  const presented = await GET_MOBILE_SESSION_BY_HASH({ token_hash: hashRefreshToken(refreshToken) })
  if (!presented) throw unauthorized()
  await REVOKE_MOBILE_SESSION({ id: presented.id })
}
