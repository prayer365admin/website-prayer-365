import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axiosMock, Providers } from '@/test/frontend/render'
import { useMediaUpload } from './media-upload'

describe('useMediaUpload', () => {
  beforeEach(() => {
    axiosMock.post.mockClear()
    // media-upload uses crypto.subtle.digest for the checksum — provide a fake
    vi.stubGlobal('crypto', {
      subtle: { digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)) },
    })
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '' }) as never
  })

  it('rejects a null file', async () => {
    const { result } = renderHook(() => useMediaUpload({ churchId: 'ch1', purpose: 'IMAGE' }), {
      wrapper: Providers,
    })
    await expect(result.current.onUpload(null)).rejects.toThrow('Please select a file to upload.')
    expect(axiosMock.post).not.toHaveBeenCalled()
  })

  it('uploads: initiate -> S3 post -> complete', async () => {
    axiosMock.post
      .mockResolvedValueOnce({
        data: {
          result: { assetId: 'a1', uploadUrl: 'https://s3.example/x', fields: { key: 'k' } },
        },
      })
      .mockResolvedValueOnce({ data: {} })

    const file = new File(['abcdef'], 'photo.png', { type: 'image/png' })
    const { result } = renderHook(() => useMediaUpload({ churchId: 'ch1', purpose: 'IMAGE' }), {
      wrapper: Providers,
    })

    const out = await result.current.onUpload(file)
    expect(out.assetId).toBe('a1')
    expect(out.url).toContain('/api/v1/uploads/a1/access')
    expect(axiosMock.post).toHaveBeenNthCalledWith(
      1,
      '/api/v1/uploads',
      expect.objectContaining({
        churchId: 'ch1',
        purpose: 'IMAGE',
        mimeType: 'image/png',
        byteSize: file.size,
      }),
    )
    expect(axiosMock.post).toHaveBeenNthCalledWith(2, '/api/v1/uploads/a1/complete', {
      churchId: 'ch1',
      checksum: expect.any(String),
    })
  })
})
