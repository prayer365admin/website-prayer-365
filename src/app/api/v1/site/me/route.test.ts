import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({ requiredWebAuth: vi.fn(), getMe: vi.fn() }))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('@/controller/mobile', () => ({ getMe: m.getMe }))

import { GET } from './route'

describe('GET /api/v1/site/me', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when there is no website session', async () => {
    m.requiredWebAuth.mockRejectedValue(
      new GeneralError({
        code: 401,
        error: 'Not Authenticated!',
        error_code: 'UNAUTHORIZED',
        details: 'Please login and try again!',
      }),
    )

    const res = await GET()

    expect(res.status).toBe(401)
  })

  it('returns the profile for the session user', async () => {
    m.requiredWebAuth.mockResolvedValue({ session: { user: { user_id: 'u1' } }, user: {} })
    m.getMe.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'A', mainChurchId: null })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(m.getMe).toHaveBeenCalledWith({ userId: 'u1' })
  })
})
