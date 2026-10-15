import { beforeEach, describe, expect, it, vi } from 'vitest'
import Layout from './layout'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
  cookies: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))
vi.mock('@/components/site/setup-guard', () => ({ default: () => null }))
vi.mock('next/headers', () => ({ cookies: m.cookies }))
vi.mock('@/components/site', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}))

const render = () => Layout({ children: 'Private website content' })

describe('(site) layout guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.cookies.mockResolvedValue({ get: () => undefined })
  })

  it('redirects unauthenticated visitors to /login', async () => {
    m.requiredWebAuth.mockRejectedValue(new Error('UNAUTHORIZED'))

    await expect(render()).rejects.toThrow('REDIRECT /login')
  })

  it('ends a session whose user is disabled or changed password (live re-check) → /login', async () => {
    // requiredWebAuth rejects when status != active or auth_version changed.
    m.requiredWebAuth.mockRejectedValue(new Error('UNAUTHORIZED'))

    await expect(render()).rejects.toThrow('REDIRECT /login')
  })

  it('does not force setup on the server: SetupGuard offers it once per browser', async () => {
    m.requiredWebAuth.mockResolvedValue({ session: { user: { user_id: 'u1', role: null } } })

    const tree = await render()

    expect(JSON.stringify(tree)).toContain('Private website content')
    expect(m.redirect).not.toHaveBeenCalled()
  })

  it('renders the shell for a signed-in customer', async () => {
    m.requiredWebAuth.mockResolvedValue({ session: { user: { user_id: 'u1', role: null } } })

    const tree = await render()

    expect(JSON.stringify(tree)).toContain('Private website content')
  })

  it('does not apply customer onboarding to staff sessions', async () => {
    m.requiredWebAuth.mockResolvedValue({
      session: { user: { user_id: 's1', role: { id: 'r1', name: 'prayer_administrator' } } },
    })

    const tree = await render()

    expect(JSON.stringify(tree)).toContain('Private website content')
  })
})
