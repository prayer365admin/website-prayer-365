import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDonationFilters } from './donation-filters'

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => nav.params,
  usePathname: () => '/dashboard/donations',
  useRouter: () => ({ replace: nav.replace }),
}))

beforeEach(() => {
  nav.params = new URLSearchParams()
  nav.replace.mockClear()
})

describe('useDonationFilters', () => {
  it('reads every filter from the query string', () => {
    nav.params = new URLSearchParams(
      'tab=recurring&church=c1&type=PRAYER&currency=eur&status=PAID&from=2026-11-01&to=2026-11-30',
    )
    const { result } = renderHook(() => useDonationFilters({ tab: 'transactions' }))

    expect(result.current.filters).toMatchObject({
      tab: 'recurring',
      churchId: 'c1',
      type: 'PRAYER',
      currency: 'eur',
      status: 'PAID',
      from: '2026-11-01',
      to: '2026-11-30',
    })
  })

  it('falls back to the default tab on an empty or unknown value', () => {
    const { result } = renderHook(() => useDonationFilters({ tab: 'transactions' }))
    expect(result.current.filters.tab).toBe('transactions')

    nav.params = new URLSearchParams('tab=')
    const empty = renderHook(() => useDonationFilters({ tab: 'transactions' }))
    expect(empty.result.current.filters.tab).toBe('transactions')
  })

  it('writes a filter, shortens churchId to `church` and resets the page', () => {
    nav.params = new URLSearchParams('page=3&tab=transactions')
    const { result } = renderHook(() => useDonationFilters({ tab: 'transactions' }))

    result.current.setFilters({ churchId: 'c1', type: 'CHURCH' })

    expect(nav.replace).toHaveBeenCalledWith(
      '/dashboard/donations?tab=transactions&church=c1&type=CHURCH',
      { scroll: false },
    )
  })

  it('deletes a filter that is set to undefined or an empty string', () => {
    nav.params = new URLSearchParams('tab=transactions&church=c1&type=PRAYER')
    const { result } = renderHook(() => useDonationFilters({ tab: 'transactions' }))

    result.current.setFilters({ churchId: undefined, type: '' })

    expect(nav.replace).toHaveBeenCalledWith('/dashboard/donations?tab=transactions', {
      scroll: false,
    })
  })
})
