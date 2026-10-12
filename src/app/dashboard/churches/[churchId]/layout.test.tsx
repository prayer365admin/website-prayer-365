import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChurchLayout from './layout'

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  resolveListScope: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))

vi.mock('@/auth', () => ({ auth: m.auth }))
vi.mock('@/controller/church', () => ({ resolveListScope: m.resolveListScope }))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))
vi.mock('@/components/container/dashboard/church-scope-guard/access-notice', () => ({
  default: () => null,
}))

const render = (churchId: string) =>
  ChurchLayout({ children: 'Private church content', params: Promise.resolve({ churchId }) })

describe('ChurchLayout scope check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.auth.mockResolvedValue({ user: { user_id: 'u1' } })
  })

  it('renders children for a church in the caller scope', async () => {
    m.resolveListScope.mockResolvedValue(new Set(['c1', 'c2']))

    const tree = await render('c2')

    expect(JSON.stringify(tree)).toContain('Private church content')
    expect(m.resolveListScope).toHaveBeenCalledWith({
      userId: 'u1',
      subject: 'prayer_church',
      action: 'read',
    })
  })

  it('redirects to the sole assigned church when out of scope', async () => {
    m.resolveListScope.mockResolvedValue(new Set(['c1']))

    await expect(render('c9')).rejects.toThrow(
      'REDIRECT /dashboard/churches/c1?notice=church_access_denied',
    )
  })

  it('redirects to the picker for many or zero assignments', async () => {
    m.resolveListScope.mockResolvedValue(new Set(['c1', 'c2']))
    await expect(render('c9')).rejects.toThrow(
      'REDIRECT /dashboard/churches?notice=church_access_denied',
    )

    m.resolveListScope.mockResolvedValue(new Set())
    await expect(render('c9')).rejects.toThrow(
      'REDIRECT /dashboard/churches?notice=church_access_denied',
    )
  })

  it('sends a missing session to login', async () => {
    m.auth.mockResolvedValue(null)

    await expect(render('c1')).rejects.toThrow('REDIRECT /admin/login')
    expect(m.resolveListScope).not.toHaveBeenCalled()
  })
})
