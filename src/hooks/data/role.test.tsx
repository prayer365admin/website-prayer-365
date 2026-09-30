import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { axiosMock, Providers, resolveGet } from '@/test/frontend/render'
import { useRoles, useRole } from './role'

const roles = [{ id: 'r1', name: 'admin', permission: [] }]

describe('useRoles', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
    axiosMock.post.mockClear()
    axiosMock.delete.mockClear()
    axiosMock.put.mockClear()
  })

  it('fetches roles', async () => {
    axiosMock.get.mockResolvedValue({ data: resolveGet(roles, 1) })
    const { result } = renderHook(() => useRoles({ queryString: '' }), { wrapper: Providers })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(roles)
    expect(axiosMock.get).toHaveBeenCalledWith(expect.stringContaining('/api/v1/roles'))
  })

  it('creates a role', async () => {
    axiosMock.post.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useRoles({}), { wrapper: Providers })
    await result.current.onCreate({ name: 'editor' } as never)
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/v1/roles',
      expect.objectContaining({ name: 'editor' }),
    )
  })

  it('deletes a role', async () => {
    axiosMock.delete.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useRoles({}), { wrapper: Providers })
    await result.current.onDelete('r1')
    expect(axiosMock.delete).toHaveBeenCalledWith('/api/v1/roles/r1')
  })
})

describe('useRole', () => {
  it('fetches a single role by id', async () => {
    axiosMock.get.mockResolvedValue({ data: { result: roles[0] } })
    const { result } = renderHook(() => useRole('r1'), { wrapper: Providers })
    await waitFor(() => expect(result.current.data).toEqual(roles[0]))
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/roles/r1')
  })

  it('does not fetch without id', () => {
    renderHook(() => useRole(undefined), { wrapper: Providers })
    expect(axiosMock.get).not.toHaveBeenCalled()
  })

  it('updates a role', async () => {
    axiosMock.put.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useRole('r1'), { wrapper: Providers })
    await result.current.onUpdate({ name: 'super' } as never)
    expect(axiosMock.put).toHaveBeenCalledWith(
      '/api/v1/roles/r1',
      expect.objectContaining({ name: 'super' }),
    )
  })
})
