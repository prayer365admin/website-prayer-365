import { act, renderHook } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { default as useScreenSize } from './screen-size'

describe('useScreenSize', () => {
  beforeEach(() => {
    // jsdom default viewport is 1024 wide
    writeWidth(window.innerWidth)
  })
  afterEach(() => {
    writeWidth(1024)
  })

  it('reports current window size on mount', () => {
    const { result } = renderHook(() => useScreenSize())
    expect(result.current.width).toBe(window.innerWidth)
    expect(result.current.height).toBe(window.innerHeight)
  })

  it('flags mobile under 768px', () => {
    writeWidth(500)
    const { result } = renderHook(() => useScreenSize())
    expect(result.current.isMobile).toBe(true)
  })

  it('updates on window resize', () => {
    const { result } = renderHook(() => useScreenSize())
    // width 1024 → isMobile false, isTablet true
    expect(result.current.isMobile).toBe(false)
    expect(result.current.isTablet).toBe(true)

    act(() => {
      writeWidth(1400)
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current.width).toBe(1400)
    expect(result.current.isMobile).toBe(false)
    expect(result.current.isTablet).toBe(false)
  })
})

function writeWidth(w: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: w })
}
