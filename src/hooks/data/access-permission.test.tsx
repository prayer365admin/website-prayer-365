import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Providers } from '@/test/frontend/render'
import { useAccessPermission } from './access-permission'

describe('useAccessPermission', () => {
  it('builds an AccessControl permission (falls back to non-user when no session)', () => {
    // helper mocks next-auth useSession → data: null, so role is undefined
    const { result } = renderHook(() => useAccessPermission(), { wrapper: Providers })
    expect(result.current).toBeDefined()
    expect(typeof result.current.readAny).toBe('function')
  })
})
