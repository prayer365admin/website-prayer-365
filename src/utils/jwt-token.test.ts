// @vitest-environment node
import { describe, expect, it, beforeAll } from 'vitest'

beforeAll(() => {
  if (!process.env.AUTH_SECRET) process.env.AUTH_SECRET = 'test-secret-for-jwt-tests'
})

const load = () => import('@/utils/jwt-token')

describe('refresh token helpers', () => {
  it('randomRefreshToken yields opaque base64url, unique per call', async () => {
    const { randomRefreshToken } = await load()
    const a = randomRefreshToken()
    const b = randomRefreshToken()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('hashRefreshToken is deterministic sha256 hex, never the plaintext', async () => {
    const { hashRefreshToken } = await load()
    const t = 'secret-value'
    expect(hashRefreshToken(t)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashRefreshToken(t)).toBe(hashRefreshToken(t))
    expect(hashRefreshToken(t)).not.toContain(t)
  })
})

describe('mobile access token', () => {
  it('round-trips and carries auth_version', async () => {
    const { signMobileAccessToken, verifyAccessToken } = await load()
    const token = await signMobileAccessToken({
      user_id: 'u1',
      email: 'a@b.c',
      name: 'A',
      role: { id: 'r1', name: 'prayer_user' },
      auth_version: 3,
    })
    const payload = await verifyAccessToken(token)
    expect(payload?.user_id).toBe('u1')
    expect(payload?.auth_version).toBe(3)
    expect(payload?.role.name).toBe('prayer_user')
  })

  it('rejects a tampered token', async () => {
    const { signMobileAccessToken, verifyAccessToken } = await load()
    const token = await signMobileAccessToken({
      user_id: 'u1',
      email: 'a@b.c',
      name: 'A',
      role: { id: 'r1', name: 'prayer_user' },
      auth_version: 1,
    })
    const payload = await verifyAccessToken(token + 'x')
    expect(payload).toBeNull()
  })
})
