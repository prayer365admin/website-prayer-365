import { pathnameMock, replaceMock, searchParamsMock } from '@/test/frontend/render'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUrlPagination } from './url-pagination'

describe('useUrlPagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pathnameMock.mockReturnValue('/dashboard/customer')
    searchParamsMock.get.mockImplementation((key: string) => {
      const values: Record<string, string> = { page: '3', limit: '25' }
      return values[key] ?? null
    })
    searchParamsMock.toString.mockReturnValue('tab=active&page=3&limit=25')
  })

  it('reads pagination from the URL and preserves other parameters when changing page', () => {
    const { result } = renderHook(() => useUrlPagination())

    expect(result.current.page).toBe(3)
    expect(result.current.pageSize).toBe(25)

    act(() => result.current.setPage(4))

    expect(replaceMock).toHaveBeenCalledWith('/dashboard/customer?tab=active&page=4&limit=25', {
      scroll: false,
    })
  })

  it('resets to the first page when the page size changes', () => {
    const { result } = renderHook(() => useUrlPagination())

    act(() => result.current.setPageSize(50))

    expect(replaceMock).toHaveBeenCalledWith('/dashboard/customer?tab=active&page=1&limit=50', {
      scroll: false,
    })
  })

  it('preserves large safe page values while bounding page size', () => {
    searchParamsMock.get.mockImplementation((key: string) =>
      key === 'page' ? '999999999999' : key === 'limit' ? '999999' : null,
    )

    const { result } = renderHook(() => useUrlPagination())

    expect(result.current.page).toBe(999999999999)
    expect(result.current.pageSize).toBe(100)
  })
})
