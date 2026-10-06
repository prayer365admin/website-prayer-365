import { axiosMock, Providers, resolveGet } from '@/test/frontend/render'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useMediaAccess } from './media-access'

describe('useMediaAccess', () => {
  it('fetches signed URL when assetId is provided', async () => {
    const accessFixture = {
      assetId: 'asset1',
      purpose: 'GENERATED_AUDIO',
      mimeType: 'audio/mpeg',
      byteSize: 100,
      status: 'READY',
      url: 'https://s3.example/signed',
      expiresIn: 3600,
    }
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet(accessFixture) })

    const { result } = renderHook(() => useMediaAccess('c1', 'asset1'), {
      wrapper: Providers,
    })

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/uploads/asset1/access?churchId=c1')
    expect(result.current.data?.url).toBe('https://s3.example/signed')
  })

  it('does not fetch when assetId is null', () => {
    renderHook(() => useMediaAccess('c1', null), { wrapper: Providers })
    expect(axiosMock.get).not.toHaveBeenCalled()
  })
})
