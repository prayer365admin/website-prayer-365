import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { axiosMock, Providers, resolveGet } from '@/test/frontend/render'
import { useCustomers } from './customer'

const customers = [{ id: 'c1', email: 'a@x.com', name: 'A', created_at: '2026-01-01' }]

describe('useCustomers', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
  })

  it('fetches customers', async () => {
    axiosMock.get.mockResolvedValue({ data: resolveGet(customers, 1) })
    const { result } = renderHook(() => useCustomers({}), { wrapper: Providers })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(customers)
    expect(result.current.total).toBe(1)
    expect(axiosMock.get).toHaveBeenCalledWith(expect.stringContaining('/api/v1/customers'))
  })
  it('passes search and status filters to query', async () => {
    axiosMock.get.mockResolvedValue({ data: resolveGet(customers, 1) })
    renderHook(() => useCustomers({ search: 'alice', status: 'active' }), { wrapper: Providers })
    expect(axiosMock.get).toHaveBeenCalledWith(expect.stringContaining('search=alice'))
    expect(axiosMock.get).toHaveBeenCalledWith(expect.stringContaining('status=active'))
  })

  it('respects enableFetch false', () => {
    renderHook(() => useCustomers({ enableFetch: false }), { wrapper: Providers })
    expect(axiosMock.get).not.toHaveBeenCalled()
  })

  it('keeps loading true during fetch', () => {
    axiosMock.get.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useCustomers({}), { wrapper: Providers })
    expect(result.current.loading).toBe(true)
  })
})
