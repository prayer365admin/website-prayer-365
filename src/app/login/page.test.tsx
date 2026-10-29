import { SITE_MESSAGES } from '@/i18n/messages'
import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Page from './page'

const {
  cookies,
  getFellowshipMemberCount,
  getLatestPlayableSitePrayer,
  redirectAuthenticatedCustomer,
} = vi.hoisted(() => ({
  cookies: vi.fn(),
  getFellowshipMemberCount: vi.fn(),
  getLatestPlayableSitePrayer: vi.fn(),
  redirectAuthenticatedCustomer: vi.fn(),
}))
vi.mock('next/headers', () => ({ cookies }))
// unstable_cache needs a Next runtime cache; in unit tests it is a passthrough so
// the cached read still hits the mocked controllers.
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/controller/site-prayer', () => ({ getLatestPlayableSitePrayer }))
vi.mock('@/controller/user', () => ({ getFellowshipMemberCount }))
vi.mock('@/utils/redirect-authenticated-customer', () => ({
  default: redirectAuthenticatedCustomer,
}))

describe('Customer login route', () => {
  it('renders the customer sign-in screen in the cookie language', async () => {
    cookies.mockResolvedValue({ get: () => ({ value: 'et' }) })
    getLatestPlayableSitePrayer.mockResolvedValue({
      id: 'p1',
      title: 'Hommikupalve',
      churchName: 'Lootuse kirik',
      pastorName: 'Daniel',
      languageCode: 'et',
      audioUrl: 'https://cdn.test/prayer.mp3',
    })
    getFellowshipMemberCount.mockResolvedValue(37)

    renderWithProviders(await Page())

    expect(redirectAuthenticatedCustomer).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('heading', { level: 1, name: SITE_MESSAGES.et.signInTitle }),
    ).toBeTruthy()
    expect(screen.getByLabelText(SITE_MESSAGES.et.signInIdentifierLabel)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Esita: Hommikupalve' })).toBeTruthy()
    expect(screen.getByText('37 osaduse liiget hoiavad praegu vaikset palvevalvet.')).toBeTruthy()
    expect(getLatestPlayableSitePrayer).toHaveBeenCalledOnce()
    expect(getFellowshipMemberCount).toHaveBeenCalledOnce()
  })
})
