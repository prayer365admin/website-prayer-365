// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/controller/mobile-auth', () => ({
  mobileLogin: vi.fn(),
  mobileRefresh: vi.fn(),
  mobileLogout: vi.fn(),
}))

import { mobileLogin, mobileRefresh, mobileLogout } from '@/controller/mobile-auth'
import { POST as POST_LOGIN } from './login/route'
import { POST as POST_REFRESH } from './refresh/route'
import { POST as POST_LOGOUT } from './logout/route'

const jsonReq = (body: unknown) =>
  new NextRequest('http://x/auth/login', { method: 'POST', body: JSON.stringify(body) })

beforeEach(() => vi.clearAllMocks())

describe('mobile auth routes', () => {
  it('login returns 200 token pair', async () => {
    vi.mocked(mobileLogin).mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 900,
      user: { id: 'u1', email: 'a@b.c', name: 'A', authVersion: 1 },
    } as never)
    const res = (await POST_LOGIN(
      jsonReq({ email: 'a@b.c', password: 'pw', installationId: 'i1' }),
    ))!
    expect(res.status).toBe(200)
    expect(mobileLogin).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.c', installationId: 'i1' }),
    )
  })

  it('login rejects malformed body as 422', async () => {
    const res = (await POST_LOGIN(jsonReq({ email: 'a@b.c' })))!
    expect(res.status).toBe(422)
    expect(mobileLogin).not.toHaveBeenCalled()
  })

  it('refresh returns fresh pair', async () => {
    vi.mocked(mobileRefresh).mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt2',
      expiresIn: 900,
    } as never)
    const res = (await POST_REFRESH(jsonReq({ refreshToken: 'rt', installationId: 'i1' })))!
    expect(res.status).toBe(200)
    expect(mobileRefresh).toHaveBeenCalledWith({ refreshToken: 'rt', installationId: 'i1' })
  })

  it('logout revokes + 200', async () => {
    vi.mocked(mobileLogout).mockResolvedValue(undefined as never)
    const res = (await POST_LOGOUT(jsonReq({ refreshToken: 'rt' })))!
    expect(res.status).toBe(200)
    expect(mobileLogout).toHaveBeenCalledWith({ refreshToken: 'rt' })
  })
})
