import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'
import MainBreadcrumb from './index'

describe('MainBreadcrumb', () => {
  it('renders Dashboard + capitalized path segments', () => {
    // helper usePathname → /dashboard/customers → crumbs: Dashboard, Customers
    renderWithProviders(<MainBreadcrumb />)
    expect(screen.getByText('Dashboard')).toBeTruthy()
    expect(screen.getByText('Customers')).toBeTruthy()
  })
})

describe('MainBreadcrumb church links', () => {
  const setup = async (granted: boolean, path: string) => {
    vi.resetModules()
    vi.doMock('next/navigation', () => ({ usePathname: () => path }))
    vi.doMock('@/hooks/data/access-permission', () => ({
      useAccessPermission: () => ({
        readAny: () => ({ granted }),
        readOwn: () => ({ granted: false }),
      }),
    }))
    const { default: Breadcrumb } = await import('./index')
    renderWithProviders(<Breadcrumb />)
  }

  it('links Churches and the church id to selector and overview', async () => {
    await setup(true, '/dashboard/churches/c1/events')
    expect(screen.getByText('Churches').closest('a')?.getAttribute('href')).toBe(
      '/dashboard/churches',
    )
    expect(screen.getByText('C1').closest('a')?.getAttribute('href')).toBe('/dashboard/churches/c1')
    expect(screen.getByText('Events').closest('a')).toBeNull()
  })

  it('does not link without church read permission', async () => {
    await setup(false, '/dashboard/churches/c1/events')
    expect(screen.getByText('Churches').closest('a')).toBeNull()
    expect(screen.getByText('C1').closest('a')).toBeNull()
  })

  it('does not link the current page', async () => {
    await setup(true, '/dashboard/churches/c1')
    expect(screen.getByText('C1').closest('a')).toBeNull()
    expect(screen.getByText('Churches').closest('a')).toBeTruthy()
  })

  it('renders UUID path segment as ellipses', async () => {
    await setup(true, '/dashboard/churches/01a1851a-7d70-7753-809c-4f746e996e46/announcements')
    const ellipsisLink = screen.getByText('...').closest('a')
    expect(ellipsisLink?.getAttribute('href')).toBe(
      '/dashboard/churches/01a1851a-7d70-7753-809c-4f746e996e46',
    )
    expect(screen.queryByText(/01a1851a/)).toBeNull()
  })
})
