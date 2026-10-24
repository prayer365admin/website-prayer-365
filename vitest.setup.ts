import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// globals:false in config → RTL cannot self-register cleanup; do it manually
afterEach(() => cleanup())

// Next's data cache needs the Next runtime. Under vitest `unstable_cache` is a
// passthrough and the revalidators are no-ops, so providers and pages that use
// the cache stay unit-testable (the caching itself is verified in production).
vi.mock('next/cache', () => ({
  unstable_cache: <T>(fn: T) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

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
