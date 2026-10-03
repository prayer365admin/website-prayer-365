// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/controller/auth', () => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}))

import { requestPasswordReset, resetPassword } from '@/controller/auth'
import { GeneralError } from '@/utils/general-error'
import { POST as POST_FORGOT } from './forgot-password/route'
import { POST as POST_RESET } from './reset-password/route'

const jsonReq = (body: unknown, host?: string) => {
  const req = new NextRequest(`http://x${host ? ` (host=${host})` : ''}/forgot-password`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return req
}

beforeEach(() => vi.clearAllMocks())

describe('mobile password recovery routes', () => {
  describe('forgot-password', () => {
    it('valid email → 200 with generic message + deep-link prefix passed to controller', async () => {
      vi.mocked(requestPasswordReset).mockResolvedValue({ success: true })
      const res = (await POST_FORGOT(jsonReq({ email: 'a@b.c' })))!
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('If your email is registered')
      expect(requestPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@b.c', linkPrefix: 'prayer-365://' }),
      )
    })

    it('missing email → 422 validation error, controller not called', async () => {
      const res = (await POST_FORGOT(jsonReq({})))!
      expect(res.status).toBe(422)
      expect(requestPasswordReset).not.toHaveBeenCalled()
    })

    it('controller throws GeneralError (cooldown) → 429', async () => {
      vi.mocked(requestPasswordReset).mockRejectedValue(
        new GeneralError({
          code: 429,
          error: 'TOO_MANY_REQUESTS',
          error_code: 'RESET_TOO_EARLY',
          details: 'Please wait 60 seconds before requesting another reset!',
        }),
      )
      const res = (await POST_FORGOT(jsonReq({ email: 'a@b.c' })))!
      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.error_code).toBe('RESET_TOO_EARLY')
    })
  })

  describe('reset-password', () => {
    it('valid request → 200 + login message', async () => {
      vi.mocked(resetPassword).mockResolvedValue({ success: true })
      const res = (await POST_RESET(
        jsonReq({ token: 't1', new_password: 'Strong@123', confirm_password: 'Strong@123' }),
      ))!
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('You can now login')
      expect(resetPassword).toHaveBeenCalledWith({ token: 't1', new_password: 'Strong@123' })
    })

    it('mismatch → 400 PASSWORD_MISMATCH, controller not called', async () => {
      const res = (await POST_RESET(
        jsonReq({ token: 't1', new_password: 'Strong@123', confirm_password: 'different' }),
      ))!
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error_code).toBe('PASSWORD_MISMATCH')
      expect(resetPassword).not.toHaveBeenCalled()
    })

    it('missing fields → 422', async () => {
      const res = (await POST_RESET(jsonReq({ token: 't1' })))!
      expect(res.status).toBe(422)
      expect(resetPassword).not.toHaveBeenCalled()
    })

    it('controller throws INVALID_PASSWORD → 400 passthrough', async () => {
      vi.mocked(resetPassword).mockRejectedValue(
        new GeneralError({
          code: 400,
          error: 'BAD_REQUEST',
          error_code: 'INVALID_PASSWORD',
          details: 'Password must be at least 8 characters!',
        }),
      )
      const res = (await POST_RESET(
        jsonReq({ token: 't1', new_password: 'x', confirm_password: 'x' }),
      ))!
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error_code).toBe('INVALID_PASSWORD')
    })
  })
})
