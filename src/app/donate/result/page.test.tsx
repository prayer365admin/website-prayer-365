// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
  getDonationStatus: vi.fn(),
  getPublicDonationStatus: vi.fn(),
  getMe: vi.fn(),
  listMyChurches: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))
vi.mock('@/utils/site-locale', () => ({ getSiteLocale: async () => 'en' }))
vi.mock('@/controller/donation', () => ({
  getDonationStatus: m.getDonationStatus,
  getPublicDonationStatus: m.getPublicDonationStatus,
}))
vi.mock('@/controller/mobile', () => ({
  getMe: m.getMe,
  listMyChurches: m.listMyChurches,
}))
vi.mock('@/components/site', () => ({
  default: ({ children, footerVariant }: { children: React.ReactNode; footerVariant?: string }) => (
    <div data-footer={footerVariant} data-testid="shell">
      {children}
    </div>
  ),
}))
vi.mock('@/components/site/session-access-guard', () => ({ default: () => null }))
vi.mock('@/components/site/setup-guard', () => ({ default: () => null }))
vi.mock('@/contents/site/give/thank-you', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="guest-branch">{JSON.stringify(props)}</div>
  ),
}))
vi.mock('@/contents/site/donation-result', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="result-branch">{JSON.stringify(props)}</div>
  ),
}))

import Page from './page'

const render = async (query: Record<string, string>) =>
  renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }))

beforeEach(() => {
  vi.clearAllMocks()
  m.getMe.mockResolvedValue({ id: 'u1', mainChurchId: null })
  m.listMyChurches.mockResolvedValue([])
})

describe('/donate/result — one page, two ledgers', () => {
  it('paints the guest outcome for a visitor without a session', async () => {
    m.requiredWebAuth.mockRejectedValue(new Error('401'))
    m.getPublicDonationStatus.mockResolvedValue({
      state: 'pending',
      amountMinor: null,
      currency: null,
      paidAt: null,
    })

    const html = await render({ session_id: 'cs_public' })

    expect(html).toContain('guest-branch')
    // Same shell as the old public thank-you page: minimal legal footer.
    expect(html).toContain('data-footer="legal-only"')
    expect(m.getPublicDonationStatus).toHaveBeenCalledWith({ query: { sessionId: 'cs_public' } })
    expect(m.getDonationStatus).not.toHaveBeenCalled()
  })

  it('paints the parish outcome for a signed-in giver', async () => {
    m.requiredWebAuth.mockResolvedValue({ session: { user: { user_id: 'u1' } } })
    m.getDonationStatus.mockResolvedValue({
      state: 'confirmed',
      churchName: 'Hope Church',
      churchSlug: 'hope',
      amountMinor: 1000,
      currency: 'EUR',
      frequency: 'one_time',
      paidAt: new Date('2026-11-13T06:00:00.000Z'),
    })

    const html = await render({
      session_id: 'cs_parish',
      churchId: 'c1',
      amountMinor: '1000',
      currency: 'eur',
      frequency: 'one_time',
    })

    expect(html).toContain('result-branch')
    // Same shell the `(site)` layout used to provide: full customer footer.
    expect(html).toContain('data-footer="full"')
    expect(m.getDonationStatus).toHaveBeenCalledWith({
      userId: 'u1',
      query: {
        sessionId: 'cs_parish',
        churchId: 'c1',
        amountMinor: 1000,
        currency: 'eur',
        frequency: 'one_time',
      },
    })
    expect(m.getPublicDonationStatus).not.toHaveBeenCalled()
  })

  it('hands a malformed signed-in result URL to the portal instead of guessing', async () => {
    m.requiredWebAuth.mockResolvedValue({ session: { user: { user_id: 'u1' } } })

    await expect(render({ session_id: 'cs_parish' })).rejects.toThrow('REDIRECT /donate')
    expect(m.getDonationStatus).not.toHaveBeenCalled()
  })

  it('sends a parish attempt without a session to sign in, not to a guest 404', async () => {
    m.requiredWebAuth.mockRejectedValue(new Error('401'))

    await expect(
      render({ session_id: 'cs_parish', churchId: 'c1', amountMinor: '1000' }),
    ).rejects.toThrow('REDIRECT /login')
    expect(m.getPublicDonationStatus).not.toHaveBeenCalled()
  })

  it('renders the unknown guest view for a session id that is not a checkout', async () => {
    m.requiredWebAuth.mockRejectedValue(new Error('401'))

    const html = await render({ session_id: 'not-a-session' })

    expect(html).toContain('guest-branch')
    expect(m.getPublicDonationStatus).not.toHaveBeenCalled()
  })
})
