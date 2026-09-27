import { jwtVerify, SignJWT } from 'jose'
import { TextEncoder } from 'util'

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET)
const EXPIRES_IN = 60 * 60 * 24 * 7 // 7 days

export interface TokenPayload {
  user_id: string
  email: string
  name?: string | null
  role: { id: string; name: string }
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

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    const claim = payload as unknown as TokenPayload
    return {
      user_id: claim.user_id,
      email: claim.email,
      name: claim.name ?? null,
      role: claim.role,
    }
  } catch {
    return null
  }
}
