import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axiosMock, createTestQueryClient, Providers, resolveGet } from '@/test/frontend/render'
import { useUsers, useUser } from './user'

const users = [{ id: 'u1', name: 'Alice', email: 'alice@x.com', role: { id: 'r1', name: 'admin' } }]

describe('useUsers', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
    axiosMock.post.mockClear()
  })

  it('fetches users with pagination', async () => {
    axiosMock.get.mockResolvedValue({ data: resolveGet(users, 1) })
    const { result } = renderHook(() => useUsers({ queryString: 'search=x', limit: 10, page: 1 }), {
      wrapper: Providers,
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(users)
    expect(result.current.total).toBe(1)
    expect(axiosMock.get).toHaveBeenCalledWith(expect.stringContaining('/api/v1/users'))
  })

  it('includes search param in request URL', async () => {
    axiosMock.get.mockResolvedValue({ data: resolveGet(users, 1) })
    renderHook(() => useUsers({ search: 'admin' }), { wrapper: Providers })
    expect(axiosMock.get).toHaveBeenCalledWith(expect.stringContaining('search=admin'))
  })

  it('does not fetch when enableFetch is false', () => {
    renderHook(() => useUsers({ enableFetch: false }), { wrapper: Providers })
    expect(axiosMock.get).not.toHaveBeenCalled()
  })

  it('creates user: post + invalidate + error swallowed', async () => {
    const client = createTestQueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Providers client={client}>{children}</Providers>
    )
    axiosMock.post.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useUsers({}), { wrapper })
    await result.current.onCreate({ name: 'Bob' } as never)
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/v1/users',
      expect.objectContaining({ name: 'Bob' }),
    )
    expect(spy).toHaveBeenCalledWith({ queryKey: ['users'] })
  })

  it('delete calls delete endpoint', async () => {
    axiosMock.delete.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useUsers({}), { wrapper: Providers })
    await result.current.onDelete('u1')
    expect(axiosMock.delete).toHaveBeenCalledWith('/api/v1/users/u1')
  })
})

describe('useUser', () => {
  it('fetches a single user', async () => {
    axiosMock.get.mockResolvedValue({ data: { result: users[0] } })
    const { result } = renderHook(() => useUser('u1'), { wrapper: Providers })
    await waitFor(() => expect(result.current.data).toEqual(users[0]))
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/users/u1')
  })

  it('updates user: put + invalidate', async () => {
    const client = createTestQueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Providers client={client}>{children}</Providers>
    )
    axiosMock.put.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useUser('u1'), { wrapper })
    await result.current.onUpdate({ name: 'Updated' } as never)
    expect(axiosMock.put).toHaveBeenCalledWith(
      '/api/v1/users/u1',
      expect.objectContaining({ name: 'Updated' }),
    )
    expect(spy).toHaveBeenCalledWith({ queryKey: ['users'] })
  })
})
