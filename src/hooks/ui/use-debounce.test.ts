import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebounce } from './use-debounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns initial value immediately without delay', () => {
    const { result } = renderHook(() => useDebounce('hello', 500))
    expect(result.current).toBe('hello')
  })

  it('debounces rapid changes and updates value only after delay has passed', () => {
    const { result, rerender } = renderHook(({ val }) => useDebounce(val, 500), {
      initialProps: { val: 'a' },
    })

    rerender({ val: 'ab' })
    rerender({ val: 'abc' })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('abc')
  })
})
