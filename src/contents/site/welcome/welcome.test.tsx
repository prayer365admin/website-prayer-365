import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { renderWithProviders } from '@/test/frontend/render'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ContentsSiteWelcome from './index'

describe('Welcome landing page (welcome-landing)', () => {
  it('renders all sections and fallbacks when prayer and memberCount are absent', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <ContentsSiteWelcome locale="en" memberCount={null} prayer={null} />
      </SiteI18nProvider>,
    )

    // TopBar (shared site header)
    expect(screen.getAllByText(SITE_MESSAGES.en.headerDiscoverChurches).length).toBeGreaterThan(0)
    expect(screen.getAllByText(SITE_MESSAGES.en.headerPrayers).length).toBeGreaterThan(0)
    expect(screen.getAllByText(SITE_MESSAGES.en.headerGiving).length).toBeGreaterThan(0)
    // Guests get no church selector
    expect(screen.queryByLabelText(SITE_MESSAGES.en.headerChooseChurch)).toBeNull()

    // Hero
    expect(screen.getByText('Ecumenical Fellowship & Daily Liturgy')).toBeTruthy()
    expect(screen.getByText('Everyday Faith.')).toBeTruthy()
    expect(screen.getByText('A More Connected Tomorrow.')).toBeTruthy()
    expect(screen.getByText('Join the Sanctuary — Register Free')).toBeTruthy()
    expect(screen.getByText('Live Sanctuary')).toBeTruthy()
    expect(screen.getByText('Pastors online for prayer')).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.en.welcomeNoOpenPrayer)).toBeTruthy()
    expect(screen.getAllByText(SITE_MESSAGES.en.welcomeStatsUnavailable).length).toBeGreaterThan(0)

    // Canonical Network strip
    expect(screen.getByText('Canonical Fellowship Network')).toBeTruthy()
    expect(screen.getByText("St. John's Church, Tallinn")).toBeTruthy()

    // Pillars
    expect(screen.getByText('Five Pillars of Our Digital Sanctuary')).toBeTruthy()
    expect(screen.getByText('365 Guided Audio Liturgies')).toBeTruthy()
    expect(screen.getAllByText('Morning Matins').length).toBeGreaterThan(0)
    expect(screen.getByText('Discover & Follow Your Church')).toBeTruthy()
    expect(screen.getByText('Confidential Pastoral Care')).toBeTruthy()
    expect(screen.getByText('Canon Law Privilege')).toBeTruthy()
    expect(screen.getByText('Diaconal Giving & Stewardship')).toBeTruthy()
    expect(screen.getByText('Winter Parish Care')).toBeTruthy()
    expect(screen.getByText('Parish Events & Retreats')).toBeTruthy()
    expect(screen.getByText('Next Taizé Vigil')).toBeTruthy()

    // Community / Moments in Sacred Fellowship
    expect(screen.getByText('Moments in Sacred Fellowship')).toBeTruthy()
    expect(screen.getByText('Light Across Ancient Stone')).toBeTruthy()
    expect(screen.getByText('Contemporary Sanctuary Space')).toBeTruthy()
    expect(screen.getByText('Quiet Water Pilgrimages')).toBeTruthy()

    // Mobile App Promo
    expect(screen.getByText('Take the Sanctuary Wherever You Walk')).toBeTruthy()
    expect(screen.getByText('06:30 Scripture Gentle Push')).toBeTruthy()
    expect(screen.getByText('Offline Liturgy Playback')).toBeTruthy()
    expect(screen.getByText('Scan on Camera')).toBeTruthy()

    // CTA
    expect(screen.getByText('Already a Parishioner or Pilgrim?')).toBeTruthy()
    expect(screen.getByText('Create Free Profile')).toBeTruthy()
    expect(screen.getByText('Sign In to Sanctuary')).toBeTruthy()
    // Testimonials
    expect(screen.getByText('Pastoral Solidarity & Testimonies')).toBeTruthy()
    expect(screen.getByText('Rev. Thomas Lindqvist')).toBeTruthy()
    expect(screen.getByText('Diaconal Sister Kristiina')).toBeTruthy()
    expect(screen.getByText('Mart Tamm')).toBeTruthy()

    // Scripture Quote
    expect(screen.getAllByText(/The Lord bless you and keep you/).length).toBeGreaterThan(0)
    expect(screen.getByText(/NUMBERS 6:24-25 • THE AARONIC BLESSING/)).toBeTruthy()

    // Footer
    expect(screen.getByText('Parish Network')).toBeTruthy()
    expect(screen.getByText('+372 644 1483')).toBeTruthy()
    expect(screen.getByText('Privacy of Confession')).toBeTruthy()
  })

  it('renders live prayer and believers count when provided, and supports audio play toggle', () => {
    const mockPrayer = {
      id: 'prayer-abc',
      title: 'Vespers of the Holy Cross',
      churchName: 'Rootsi-Mihkli kirik',
      pastorName: 'Dean Patrik',
      languageCode: 'SV',
      audioUrl: 'https://example.com/audio/vespers.mp3',
      introduction: 'Be still and know that I am God.',
      churchCoverUrl: 'https://example.com/church-cover.jpg',
    }

    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <ContentsSiteWelcome locale="en" memberCount={42100} prayer={mockPrayer} />
      </SiteI18nProvider>,
    )

    expect(screen.getByText('Vespers of the Holy Cross')).toBeTruthy()
    expect(screen.getByText('Dean Patrik')).toBeTruthy()
    expect(screen.getByText('Rootsi-Mihkli kirik')).toBeTruthy()
    expect(screen.getByText(/Be still and know that I am God\./)).toBeTruthy()
    expect(screen.getByText('42,100 Believers')).toBeTruthy()

    // Audio play toggle button exists and is clickable
    const playBtn = screen.getByRole('button', {
      name: /Play audio prayer: Vespers of the Holy Cross/,
    })
    expect(playBtn).toBeTruthy()
    fireEvent.click(playBtn)
  })
})
