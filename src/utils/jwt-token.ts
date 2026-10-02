import { jwtVerify, SignJWT } from 'jose'
import { TextEncoder } from 'util'
import { randomBytes, createHash } from 'crypto'

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET)
const EXPIRES_IN = 60 * 60 * 24 * 7 // 7 days

// D1 mobile token contract (plan 002): short-lived access JWT (15 min) carries
// the user's `auth_version` so authorization boundaries can reject tokens issued
// before a password change / disable. Refresh tokens are opaque + hashed.
const MOBILE_ACCESS_TTL_MS = 15 * 60 * 1000

export interface TokenPayload {
  user_id: string
  email: string
  name?: string | null
  role: { id: string; name: string }
}

export interface MobileTokenPayload extends TokenPayload {
  auth_version: number
}

export async function signAccessToken(payload: TokenPayload) {
  return new SignJWT({
    user_id: payload.user_id,
    email: payload.email,
    name: payload.name,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN}s`)
    .sign(SECRET)
}

/**
 * Short-lived access token for the mobile token contract. Carries `auth_version`
 * so required-auth can reject a token minted before a password change/disable.
 */
export async function signMobileAccessToken(payload: MobileTokenPayload) {
  return new SignJWT({
    user_id: payload.user_id,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    auth_version: payload.auth_version,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MOBILE_ACCESS_TTL_MS / 1000}s`)
    .sign(SECRET)
}

/** Opaque refresh-token value (32 random bytes, base64url). Stored only hashed. */
export function randomRefreshToken(): string {
  return randomBytes(32).toString('base64url')
}

/** SHA-256 of a refresh token — the only form persisted in `auth_token`. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function verifyAccessToken(
  token: string,
): Promise<(TokenPayload & { auth_version?: number }) | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    const claim = payload as unknown as TokenPayload & { auth_version?: number }
    return {
      user_id: claim.user_id,
      email: claim.email,
      name: claim.name ?? null,
      role: claim.role,
      auth_version: claim.auth_version,
    }
  } catch {
    return null
  }
}
