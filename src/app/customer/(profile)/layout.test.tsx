import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerLayout from './layout'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
  getMe: vi.fn(),
  listMyChurches: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))
vi.mock('@/utils/site-locale', () => ({ getSiteLocale: () => 'en' }))
vi.mock('@/controller/mobile', () => ({
  getMe: m.getMe,
  listMyChurches: m.listMyChurches,
}))
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
vi.mock('./_components/customer-profile-header', () => ({
  default: ({ initialMe }: { initialMe: { name: string } }) => (
    <section>Customer profile header: {initialMe.name}</section>
  ),
}))
vi.mock('./_components/profile-shell', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>
      <nav aria-label="Customer profile" />
      {children}
    </div>
  ),
}))

const layout = () => CustomerLayout({ children: <div>Customer profile</div> })

describe('/customer layout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the website header and footer with the profile summary and navigation', async () => {
    m.requiredWebAuth.mockResolvedValue({
      session: { user: { user_id: 'u1', role: null } },
      user: {
        created_at: new Date('2024-10-01T00:00:00.000Z'),
        email_verified_at: new Date('2024-10-02T00:00:00.000Z'),
      },
    })
    m.getMe.mockResolvedValue({ id: 'u1', name: 'Maria' })
    m.listMyChurches.mockResolvedValue([])
    render(await layout())

    expect(screen.getByText('General website header')).toBeTruthy()
    expect(screen.getByText('Customer profile header: Maria')).toBeTruthy()
    expect(screen.getByRole('main').textContent).toContain('Customer profile')
    expect(screen.getByRole('navigation', { name: 'Customer profile' })).toBeTruthy()
    expect(screen.getByText('Website footer')).toBeTruthy()
  })

  it('sends a guest to the sign-in page before loading profile data', async () => {
    m.requiredWebAuth.mockRejectedValue(new Error('no session'))

    await expect(layout()).rejects.toThrow('REDIRECT /login')
    expect(m.getMe).not.toHaveBeenCalled()
  })

  // Plan 022: the customer area is customer-only; a staff session is sent to the
  // dashboard before any read (it has no customer data and must not create any).
  it('sends a staff session to the dashboard before loading profile data', async () => {
    m.requiredWebAuth.mockResolvedValue({
      session: { user: { user_id: 'u1', role: { id: 'r1', name: 'administrator' } } },
      user: {},
    })

    await expect(layout()).rejects.toThrow('REDIRECT /dashboard')
    expect(m.getMe).not.toHaveBeenCalled()
    expect(m.listMyChurches).not.toHaveBeenCalled()
  })
})
