import '@ant-design/v5-patch-for-react-19'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// globals:false in config → RTL cannot self-register cleanup; do it manually
afterEach(() => cleanup())

// antd v5 needs these in jsdom
globalThis.matchMedia =
  globalThis.matchMedia ||
  ((query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList)

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  globalThis.ResizeObserver || (ResizeObserverMock as unknown as typeof ResizeObserver)

class IntersectionObserverMock {
  root = null
  rootMargin = ''
  thresholds = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
globalThis.IntersectionObserver =
  globalThis.IntersectionObserver ||
  (IntersectionObserverMock as unknown as typeof IntersectionObserver)
