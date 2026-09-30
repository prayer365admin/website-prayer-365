import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useScrollDetection } from './scroll-detection'

describe('useScrollDetection', () => {
  it('returns default visible, no background state', () => {
    const { result } = renderHook(() => useScrollDetection())
    expect(result.current.isVisible).toBe(true)
    expect(result.current.withBackground).toBe(false)
  })
})
