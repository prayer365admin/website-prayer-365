import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Page from './page'

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
vi.mock('@/controller/mobile', () => ({
  getMe: m.getMe,
  listMyChurches: m.listMyChurches,
}))
vi.mock('../_components/church-affiliations', () => ({
  default: ({ initialChurches }: { initialChurches: { churchName: string }[] }) => (
    <div>Affiliations: {initialChurches.map((church) => church.churchName).join(', ')}</div>
  ),
}))

describe('/customer/church-affiliations page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects unauthenticated customers before loading church data', async () => {
    m.requiredWebAuth.mockRejectedValue(new Error('UNAUTHORIZED'))

    await expect(Page()).rejects.toThrow('REDIRECT /login')
    expect(m.getMe).not.toHaveBeenCalled()
    expect(m.listMyChurches).not.toHaveBeenCalled()
  })

  it('loads the customer profile and church relationships', async () => {
    m.requiredWebAuth.mockResolvedValue({ session: { user: { user_id: 'u1' } } })
    m.getMe.mockResolvedValue({ id: 'u1', mainChurchId: 'c1' })
    m.listMyChurches.mockResolvedValue([{ churchId: 'c1', churchName: 'Primary Church' }])

    render(await Page())

    expect(screen.getByText('Affiliations: Primary Church')).toBeTruthy()
    expect(m.getMe).toHaveBeenCalledWith({ userId: 'u1' })
    expect(m.listMyChurches).toHaveBeenCalledWith({ userId: 'u1' })
  })
})
