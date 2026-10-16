import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axiosMock, Providers, resolveGet, sessionMock } from '@/test/frontend/render'
import { useAvatarUpload } from './avatar'

describe('useAvatarUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockReturnValue({ data: { user: { user_id: 'u1' } } })
  })

  it('signs, uploads the file to S3 last, then saves the public URL', async () => {
    axiosMock.post
      .mockResolvedValueOnce({
        data: resolveGet({
          uploadUrl: 'https://bucket.s3.eu-north-1.amazonaws.com/',
          fields: { key: 'user-avatars/u1/a.png', Policy: 'p' },
          objectKey: 'user-avatars/u1/a.png',
          expiresIn: 900,
        }),
      })
      .mockResolvedValueOnce({ data: {} })
    axiosMock.patch.mockResolvedValue({ data: resolveGet({ id: 'u1' }) })
    const file = new File(['x'], 'a.png', { type: 'image/png' })

    const { result } = renderHook(() => useAvatarUpload(), { wrapper: Providers })
    await result.current.onUpload(file)

    expect(axiosMock.post).toHaveBeenNthCalledWith(1, '/api/v1/site/me/avatar', {
      mimeType: 'image/png',
      byteSize: 1,
    })
    const form = axiosMock.post.mock.calls[1][1] as FormData
    expect(axiosMock.post.mock.calls[1][0]).toBe('https://bucket.s3.eu-north-1.amazonaws.com/')
    expect(Array.from(form.keys())).toEqual(['key', 'Policy', 'file'])
    expect(axiosMock.patch).toHaveBeenCalledWith('/api/v1/site/me', {
      profilePicture: 'https://bucket.s3.eu-north-1.amazonaws.com/user-avatars/u1/a.png',
    })
  })
})
