import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
