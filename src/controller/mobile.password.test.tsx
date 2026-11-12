import { beforeEach, describe, expect, it, vi } from 'vitest'

const { IS_LOGIN_BLOCKED } = vi.hoisted(() => ({ IS_LOGIN_BLOCKED: vi.fn() }))

vi.mock('@/providers/mobile', () => ({ GET_ME_PROFILE: vi.fn() }))
vi.mock('@/controller/authentication', () => ({ loginUser: vi.fn() }))
vi.mock('@/controller/user', () => ({ updateUser: vi.fn() }))
vi.mock('@/providers/auth-login-attempt', () => ({ IS_LOGIN_BLOCKED }))

import { GET_ME_PROFILE } from '@/providers/mobile'
import { loginUser } from '@/controller/authentication'
import { updateUser } from '@/controller/user'
import { MobileChangePasswordSchema } from '@/models/mobile'
import { changeMyPassword } from './mobile'

const data = {
  current_password: 'old-password',
  new_password: 'new-password1',
  confirm_password: 'new-password1',
}

const errorCode = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (e) {
    return (e as { error_code?: string }).error_code
  }
  return undefined
}

describe('changeMyPassword (POST /mobile/me/password)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(GET_ME_PROFILE).mockResolvedValue({ id: 'u1', email: 'a@b.c' } as never)
    vi.mocked(loginUser).mockResolvedValue({ id: 'u1' } as never)
    vi.mocked(updateUser).mockResolvedValue({} as never)
    IS_LOGIN_BLOCKED.mockResolvedValue(false)
  })

  it('verifies the current password through login, then sets the new one for the session user', async () => {
    await expect(changeMyPassword({ userId: 'u1', data })).resolves.toEqual({ success: true })
    expect(loginUser).toHaveBeenCalledWith({ email: 'a@b.c', password: 'old-password' })
    expect(updateUser).toHaveBeenCalledWith({
      user_id: 'u1',
      payload: { password: 'new-password1' },
    })
  })

  it('rejects a confirm mismatch before touching anything', async () => {
    const code = await errorCode(
      changeMyPassword({ userId: 'u1', data: { ...data, confirm_password: 'other-pass1' } }),
    )
    expect(code).toBe('PASSWORD_MISMATCH')
    expect(loginUser).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('rejects a password shorter than 8 characters', async () => {
    const code = await errorCode(
      changeMyPassword({
        userId: 'u1',
        data: { ...data, new_password: 'short', confirm_password: 'short' },
      }),
    )
    expect(code).toBe('INVALID_PASSWORD')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('rejects a wrong current password and changes nothing', async () => {
    vi.mocked(loginUser).mockRejectedValue(new Error('INVALID_CREDENTIALS'))
    const code = await errorCode(changeMyPassword({ userId: 'u1', data }))
    expect(code).toBe('INVALID_CURRENT_PASSWORD')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('404s when the session user no longer exists', async () => {
    vi.mocked(GET_ME_PROFILE).mockResolvedValue(null as never)
    const code = await errorCode(changeMyPassword({ userId: 'gone', data }))
    expect(code).toBe('RESOURCE_NOT_FOUND')
    expect(loginUser).not.toHaveBeenCalled()
  })

  it('reports a locked account as ACCOUNT_LOCKED, not a wrong password', async () => {
    IS_LOGIN_BLOCKED.mockResolvedValue(true)
    const code = await errorCode(changeMyPassword({ userId: 'u1', data }))
    expect(code).toBe('ACCOUNT_LOCKED')
    expect(loginUser).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('reports an unverified email as EMAIL_NOT_VERIFIED', async () => {
    vi.mocked(loginUser).mockRejectedValue(
      Object.assign(new Error('EMAIL_NOT_VERIFIED'), { code: 'EMAIL_NOT_VERIFIED' }),
    )
    const code = await errorCode(changeMyPassword({ userId: 'u1', data }))
    expect(code).toBe('EMAIL_NOT_VERIFIED')
    expect(updateUser).not.toHaveBeenCalled()
  })
})

describe('MobileChangePasswordSchema', () => {
  it('requires all three fields and rejects unknown keys', () => {
    expect(MobileChangePasswordSchema.safeParse(data).success).toBe(true)
    expect(MobileChangePasswordSchema.safeParse({ new_password: 'x' }).success).toBe(false)
    expect(MobileChangePasswordSchema.safeParse({ ...data, userId: 'someone-else' }).success).toBe(
      false,
    )
  })
})
