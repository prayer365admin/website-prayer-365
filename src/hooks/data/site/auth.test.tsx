import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { axiosMock, Providers } from '@/test/frontend/render'
import { useSignup } from './auth'

const payload = {
  full_name: 'Maria',
  email: 'maria@example.com',
  password: 'password1',
  locale: 'et',
  main_church_id: 'c1',
}

const axiosError = (error_code: string) =>
  Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { data: { error_code } },
  })

describe('useSignup', () => {
  beforeEach(() => axiosMock.post.mockReset())

  it('posts the payload with confirm_password = password and returns the result', async () => {
    axiosMock.post.mockResolvedValue({
      data: {
        result: {
          id: 'u1',
          email: 'maria@example.com',
          name: 'Maria',
          verification_email_sent: true,
        },
      },
    })
    const { result } = renderHook(() => useSignup(), { wrapper: Providers })

    expect(await result.current.onSignup(payload)).toEqual({
      id: 'u1',
      email: 'maria@example.com',
      name: 'Maria',
      verification_email_sent: true,
    })
    expect(axiosMock.post).toHaveBeenCalledWith('/api/v1/auth/signup', {
      ...payload,
      confirm_password: 'password1',
    })
  })

  it('maps a backend error_code to its form field and message', async () => {
    axiosMock.post.mockRejectedValueOnce(axiosError('USER_EXISTS'))
    const { result } = renderHook(() => useSignup(), { wrapper: Providers })

    await expect(result.current.onSignup(payload)).rejects.toThrow()
    await waitFor(() =>
      expect(result.current.fieldError).toEqual({ field: 'email', message: 'signUpErrorExists' }),
    )
    expect(result.current.failed).toBe(true)
  })

  it('reports an unmapped failure with no field (general error)', async () => {
    axiosMock.post.mockRejectedValueOnce(new Error('network down'))
    const { result } = renderHook(() => useSignup(), { wrapper: Providers })

    await expect(result.current.onSignup(payload)).rejects.toThrow()
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.fieldError).toBeNull()
  })
})
