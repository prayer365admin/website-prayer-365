import { beforeEach, describe, expect, it, vi } from 'vitest'
import Layout from './layout'

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
  cookies: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: m.auth }))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))
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
    m.auth.mockResolvedValue(null)

    await expect(render()).rejects.toThrow('REDIRECT /login')
  })

  it('renders the shell for a signed-in customer', async () => {
    m.auth.mockResolvedValue({ user: { user_id: 'u1', role: null } })

    const tree = await render()

    expect(JSON.stringify(tree)).toContain('Private website content')
  })
})
