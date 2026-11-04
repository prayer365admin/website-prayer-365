import { SITE_MESSAGES } from '@/i18n/messages'
import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Page from './page'

const { cookies, getCachedWelcomePublicData, redirectAuthenticatedCustomer } = vi.hoisted(() => ({
  cookies: vi.fn(),
  getCachedWelcomePublicData: vi.fn(),
  redirectAuthenticatedCustomer: vi.fn(),
}))

vi.mock('next/headers', () => ({ cookies }))
vi.mock('@/utils/site-public-cache', () => ({ getCachedWelcomePublicData }))
vi.mock('@/utils/redirect-authenticated-customer', () => ({
  default: redirectAuthenticatedCustomer,
}))

describe('/welcome route page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookies.mockResolvedValue({ get: () => ({ value: 'en' }) })
  })

  it('checks authenticated customer session and redirects before rendering', async () => {
    getCachedWelcomePublicData.mockResolvedValue({
      prayer: null,
      memberCount: null,
    })

    await Page()

    expect(redirectAuthenticatedCustomer).toHaveBeenCalledOnce()
  })

  it('renders welcome hero and fallback labels when data is null', async () => {
    getCachedWelcomePublicData.mockResolvedValue({
      prayer: null,
      memberCount: null,
    })

    renderWithProviders(await Page())

    expect(screen.getByText('Everyday Faith.')).toBeTruthy()
    expect(screen.getByText('A More Connected Tomorrow.')).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.en.welcomeNoOpenPrayer)).toBeTruthy()
    expect(screen.getAllByText(SITE_MESSAGES.en.welcomeStatsUnavailable).length).toBeGreaterThan(0)
  })

  it('renders real prayer and member count when available', async () => {
    getCachedWelcomePublicData.mockResolvedValue({
      prayer: {
        id: 'prayer-123',
        title: 'Morning Liturgy of Peace',
        churchName: "St. John's Church",
        pastorName: 'Pastor Jaanus',
        languageCode: 'ET',
        audioUrl: 'https://example.com/audio.mp3',
        introduction: 'Come before the Lord with a quiet heart.',
        churchCoverUrl: 'https://example.com/parnu-cover.jpg',
      },
      memberCount: 14820,
    })

    renderWithProviders(await Page())

    expect(screen.getByText('Morning Liturgy of Peace')).toBeTruthy()
    expect(screen.getByText('Pastor Jaanus')).toBeTruthy()
    expect(screen.getByText("St. John's Church")).toBeTruthy()
    expect(screen.getByText(/14,820 Believers/)).toBeTruthy()
  })
})
