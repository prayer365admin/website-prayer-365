import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CustomerLayout from './layout'

vi.mock('@/utils/site-locale', () => ({ getSiteLocale: () => 'en' }))
vi.mock('@/components/container/dashboard/header', () => ({
  default: ({ logoutCallbackUrl }: { logoutCallbackUrl: string }) => (
    <header>Customer header ({logoutCallbackUrl})</header>
  ),
}))
vi.mock('@/components/site/setup-guard', () => ({ default: () => null }))
vi.mock('@/components/container/dashboard/footer', () => ({
  default: () => <footer>Customer footer</footer>,
}))

const layout = () => CustomerLayout({ children: <div>Customer profile</div> })

describe('/customer layout', () => {
  it('renders a dashboard-style header, content area and footer without a sidebar', async () => {
    render(await layout())

    expect(screen.getByText('Customer header (/login)')).toBeTruthy()
    expect(screen.getByRole('main').textContent).toContain('Customer profile')
    expect(screen.getByText('Customer footer')).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})
