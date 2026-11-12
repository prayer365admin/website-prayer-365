// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({ requiredAuth: vi.fn(), changeMyPassword: vi.fn() }))

vi.mock('@/utils/required-auth', () => ({ default: m.requiredAuth }))
vi.mock('@/controller/mobile', () => ({ changeMyPassword: m.changeMyPassword }))

import { POST } from './route'

const body = {
  current_password: 'old-password',
  new_password: 'new-password1',
  confirm_password: 'new-password1',
}
const req = (b: unknown) =>
  new NextRequest('http://x/api/v1/mobile/me/password', { method: 'POST', body: JSON.stringify(b) })

describe('POST /api/v1/mobile/me/password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.requiredAuth.mockResolvedValue({ session: { user: { user_id: 'u1' } } })
  })

  it('401 without a bearer token', async () => {
    m.requiredAuth.mockRejectedValue(
      new GeneralError({
        code: 401,
        error: 'Not Authenticated!',
        error_code: 'UNAUTHORIZED',
        details: 'x',
      }),
    )
    expect((await POST(req(body)))!.status).toBe(401)
    expect(m.changeMyPassword).not.toHaveBeenCalled()
  })

  it('422 on a malformed body', async () => {
    expect((await POST(req({ new_password: 'x' })))!.status).toBe(422)
    expect(m.changeMyPassword).not.toHaveBeenCalled()
  })

  it('200 and uses the session user, never a body id', async () => {
    m.changeMyPassword.mockResolvedValue({ success: true })
    const res = (await POST(req(body)))!
    expect(res.status).toBe(200)
    expect(m.changeMyPassword).toHaveBeenCalledWith({ userId: 'u1', data: body })
  })

  it('passes controller errors through (wrong current password)', async () => {
    m.changeMyPassword.mockRejectedValue(
      new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'INVALID_CURRENT_PASSWORD',
        details: 'x',
      }),
    )
    expect((await POST(req(body)))!.status).toBe(400)
  })
})
