import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { axiosMock, Providers, resolveGet } from '@/test/frontend/render'
import { useChurchOptions, useFrequentChurches } from './church-option'

const options = [{ id: 'c1', slug: 'tallinna-jaani', name: 'Tallinna Jaani', city: 'Tallinn' }]

describe('useChurchOptions', () => {
  beforeEach(() => {
    axiosMock.get.mockReset()
    axiosMock.get.mockResolvedValue({ data: resolveGet(options) })
  })
  afterEach(() => vi.useRealTimers())

  it('loads all options with no search, then one debounced request per pause', async () => {
    const { result, rerender } = renderHook(({ search }) => useChurchOptions(search), {
      wrapper: Providers,
      initialProps: { search: '' },
    })
    await waitFor(() => expect(result.current.data).toEqual(options))
    expect(axiosMock.get).toHaveBeenLastCalledWith('/api/v1/public/churches', { params: {} })

    vi.useFakeTimers()
    rerender({ search: 'j' })
    rerender({ search: 'ja' })
    rerender({ search: 'jaa ' })
    act(() => vi.advanceTimersByTime(300))
    vi.useRealTimers()

    await waitFor(() =>
      expect(axiosMock.get).toHaveBeenLastCalledWith('/api/v1/public/churches', {
        params: { search: 'jaa' },
      }),
    )
    expect(axiosMock.get).toHaveBeenCalledTimes(2)
  })
})

describe('useFrequentChurches', () => {
  it('fetches the frequent list', async () => {
    axiosMock.get.mockResolvedValue({ data: resolveGet(options) })
    const { result } = renderHook(() => useFrequentChurches(), { wrapper: Providers })

    await waitFor(() => expect(result.current.data).toEqual(options))
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/public/churches/frequent')
  })
})
