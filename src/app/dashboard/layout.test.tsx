import { beforeEach, describe, expect, it, vi } from 'vitest'
import Layout from './layout'

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))

vi.mock('@/auth', () => ({ auth: m.auth }))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))
vi.mock('@/components/container/dashboard', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}))

const render = () => Layout({ children: 'Admin content' })

describe('dashboard layout guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.auth.mockResolvedValue(null)
  })

  it('redirects unauthenticated users to /admin/login', async () => {
    await expect(render()).rejects.toThrow('REDIRECT /admin/login')
  })

  it('redirects a role-less (customer) session to /', async () => {
    m.auth.mockResolvedValue({ user: { user_id: 'c1', role: null } })

    await expect(render()).rejects.toThrow('REDIRECT /')
  })

  it('renders the admin shell for a staff session', async () => {
    m.auth.mockResolvedValue({
      user: { user_id: 's1', role: { id: 'r1', name: 'prayer_administrator' } },
    })

    const tree = await render()

    expect(JSON.stringify(tree)).toContain('Admin content')
  })
})
