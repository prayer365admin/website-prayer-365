import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerLayout from './layout'

const { requiredWebAuth, redirect } = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: requiredWebAuth }))
vi.mock('next/navigation', () => ({ redirect }))
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
  beforeEach(() => {
    redirect.mockReset()
    requiredWebAuth.mockResolvedValue({ session: { user: { user_id: 'u1', role: null } } })
  })

  it('renders the general website header and footer without a dashboard sidebar', async () => {
    render(await layout())

    expect(screen.getByText('General website header')).toBeTruthy()
    expect(screen.getByRole('main').textContent).toContain('Customer profile')
    expect(screen.getByText('Website footer')).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('sends a guest to the sign-in page', async () => {
    requiredWebAuth.mockRejectedValue(new Error('no session'))

    await layout()

    expect(redirect).toHaveBeenCalledWith('/login')
  })
})
