import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SplashScreen from './index'

describe('SplashScreen', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders and clears body overflow after the timeout', () => {
    vi.useFakeTimers()
    render(<SplashScreen />)
    expect(document.body.style.overflow).toBe('hidden')
    act(() => {
      vi.advanceTimersByTime(1600)
    })
    expect(document.body.style.overflow).toBe('auto')
  })
})
