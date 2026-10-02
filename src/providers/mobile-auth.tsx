import { AuthTokenType, Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'

/*
 * D1 mobile refresh-token store (SPEC §3.1 / plan 002).
 *
 * Raw DB only — ALL rotation / reuse-detection / auth_version logic lives in
 * the controller (`src/controller/mobile-auth.tsx`). The stored `token` is the
 * SHA-256 hash of the opaque refresh value; the plaintext is returned to the
 * client exactly once at issuance.
 */

const REFRESH_TYPE = 'MOBILE_REFRESH' as AuthTokenType

/**
 * Persist a new refresh token. `tokenHash` comes from `hashRefreshToken()`.
 * Same `family_id` links a rotating chain of single-use tokens so a reused
 * (already `used_at`) token can revoke the whole family.
 */
/** Persist a new refresh token. `tokenHash` comes from `hashRefreshToken()`. */
export const CREATE_MOBILE_SESSION = async ({
  user_id,
  token_hash,
  installation_id,
  family_id,
  expires_at,
  auth_version,
}: {
  user_id: string
  token_hash: string
  installation_id: string
  family_id: string
  expires_at: Date
  auth_version: number
}) => {
  const result = await db.authToken.create({
    data: {
      user_id,
      token: token_hash,
      type: REFRESH_TYPE,
      expires_at,
      installation_id,
      family_id,
      auth_version,
    },
  })
  return result
}

/**
 * Fetch a session by the presented refresh token's hash. Includes an empty
 * `used_at` so the controller can distinguish first-use (valid) vs reuse (theft).
 */
export const GET_MOBILE_SESSION_BY_HASH = async ({ token_hash }: { token_hash: string }) => {
  const result = await db.authToken.findFirst({
    where: { token: token_hash, type: REFRESH_TYPE },
  })
  return result
}

/** Atomic single-user rotation: mark the presented token used AND insert its replacement. */
export const ROTATE_MOBILE_SESSION = async ({
  presented_id,
  user_id,
  token_hash,
  installation_id,
  family_id,
  auth_version,
  new_expires_at,
  tx,
}: {
  presented_id: string
  user_id: string
  token_hash: string
  installation_id: string
  family_id: string
  auth_version: number
  new_expires_at: Date
  tx?: Prisma.TransactionClient
}) => {
  const client: Prisma.TransactionClient = tx ?? (db as unknown as Prisma.TransactionClient)
  await client.authToken.update({
    data: { used_at: new Date() },
    where: { id: presented_id },
  })
  const created = await client.authToken.create({
    data: {
      user_id,
      token: token_hash,
      type: REFRESH_TYPE,
      expires_at: new_expires_at,
      installation_id,
      family_id,
      auth_version,
    },
    select: { id: true, token: true },
  })
  return { id: created.id, token: created.token }
}

/** Revoke one device session (logout). */
export const REVOKE_MOBILE_SESSION = async ({ id }: { id: string }) => {
  const result = await db.authToken.update({
    data: { revoked_at: new Date() },
    where: { id },
  })
  return result
}

/**
 * Revoke the whole family (theft signal). Marks every outstanding member
 * `revoked_at`; expired rows are ignored by the expiry check anyway.
 */
export const REVOKE_SESSION_FAMILY = async ({ family_id }: { family_id: string }) => {
  const result = await db.authToken.updateMany({
    data: { revoked_at: new Date() },
    where: { family_id, type: REFRESH_TYPE },
  })
  return result.count
}
