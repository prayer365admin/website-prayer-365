import { axiosMock, Providers, resolveGet } from '@/test/frontend/render'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useChurchPastors } from './pastor'

describe('useChurchPastors', () => {
  const pastorA = {
    id: 'pastor-1',
    name: 'Pastor A',
    introduction: null,
    pastoralRole: 'Lead',
    imageAssetId: null,
    activeVoiceProfileId: 'vo1',
    voiceReady: true,
  }

  it('fetches pastors for a given church', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet([pastorA]) })

    const { result } = renderHook(() => useChurchPastors('c1'), {
      wrapper: Providers,
    })

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/admin/churches/c1/pastors')
    expect(result.current.data).toEqual([pastorA])
  })

  it('does not fetch when churchId is empty', () => {
    renderHook(() => useChurchPastors(''), { wrapper: Providers })
    expect(axiosMock.get).not.toHaveBeenCalled()
  })
})
