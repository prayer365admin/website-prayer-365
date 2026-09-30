import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { axiosMock, Providers } from '@/test/frontend/render'
import { usePermissions } from './permission'

const permissions = [{ id: 'p1', subject: 'user', action: 'read', scope: 'ANY' }]

describe('usePermissions', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
  })

  it('fetches permissions', async () => {
    axiosMock.get.mockResolvedValue({ data: { result: permissions } })
    const { result } = renderHook(() => usePermissions(), { wrapper: Providers })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(permissions)
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/permissions')
  })
})
