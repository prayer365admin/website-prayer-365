import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CustomerLayout from './layout'

vi.mock('@/utils/site-locale', () => ({ getSiteLocale: () => 'en' }))
vi.mock('@/components/site/setup-guard', () => ({ default: () => null }))
vi.mock('@/components/site/session-access-guard', () => ({ default: () => null }))
vi.mock('@/components/site', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>
      <header>General website header</header>
      {children}
      <footer>Website footer</footer>
    </div>
  ),
}))

const layout = () => CustomerLayout({ children: <div>Customer profile</div> })

describe('/customer layout', () => {
  it('renders the general website header and footer without a dashboard sidebar', async () => {
    render(await layout())

    expect(screen.getByText('General website header')).toBeTruthy()
    expect(screen.getByRole('main').textContent).toContain('Customer profile')
    expect(screen.getByText('Website footer')).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})
