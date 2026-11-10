import { SiteLocale } from '@/config/site-locale'
import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider, useSiteI18n } from '@/i18n/site-i18n'
import { renderWithProviders } from '@/test/frontend/render'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ContentsSiteWelcome from './index'

/** Mirrors the top-bar language switcher: it only calls `setLocale`. */
function SwitchTo({ locale }: { locale: SiteLocale }) {
  const { setLocale } = useSiteI18n()
  return (
    <button onClick={() => setLocale(locale)} type="button">
      switch
    </button>
  )
}

describe('Welcome landing page (welcome-landing)', () => {
  it('renders all sections and fallbacks when prayer and memberCount are absent', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <ContentsSiteWelcome memberCount={null} prayer={null} />
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
    // Store envs drive the promo badges only; hero badges always jump to #app-promo.
    const hero = within(screen.getByLabelText('Welcome Hero'))
    expect(hero.getByLabelText('Download on the App Store').getAttribute('href')).toBe('#app-promo')
    expect(hero.getByLabelText('Get it on Google Play').getAttribute('href')).toBe('#app-promo')
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
    // The downloadable QR card was removed from the promo.
    expect(screen.queryByText('Scan on Camera')).toBeNull()

    // CTA
    expect(screen.getByText('Already a Parishioner or Pilgrim?')).toBeTruthy()
    expect(screen.getByText('Create Free Profile')).toBeTruthy()
    expect(screen.getByText('Sign In to Sanctuary')).toBeTruthy()
    // Testimonials
    expect(screen.getByText('Pastoral Solidarity & Testimonies')).toBeTruthy()
    expect(screen.getByText('Rev. Thomas Lindqvist')).toBeTruthy()
    expect(screen.getByText('Diaconal Sister Kristiina')).toBeTruthy()
    expect(screen.getByText('Arnold Lepp')).toBeTruthy()

    // Scripture Quote
    expect(screen.getAllByText(/The Lord bless you and keep you/).length).toBeGreaterThan(0)
    expect(screen.getByText(SITE_MESSAGES.en.welcomeScriptureAttribution)).toBeTruthy()

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
        <ContentsSiteWelcome memberCount={42100} prayer={mockPrayer} />
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

  it('renders the translated copy for the active locale', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="et">
        <ContentsSiteWelcome memberCount={null} prayer={null} />
      </SiteI18nProvider>,
    )

    expect(screen.getByText(SITE_MESSAGES.et.welcomeHeroTitleQuote)).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.et.welcomeHeroTitle)).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.et.welcomePillarsTitle)).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.et.welcomeCtaTitle)).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.et.welcomeFooterParishNetwork)).toBeTruthy()

    // English marketing copy must not leak through in a translated locale.
    expect(screen.queryByText('Everyday Faith.')).toBeNull()
    expect(screen.queryByText('Five Pillars of Our Digital Sanctuary')).toBeNull()
  })

  it('switches language in place without a page reload', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <ContentsSiteWelcome memberCount={null} prayer={null} />
        <SwitchTo locale="sv" />
      </SiteI18nProvider>,
    )

    expect(screen.getByText(SITE_MESSAGES.en.welcomeHeroTitleQuote)).toBeTruthy()

    act(() => screen.getByRole('button', { name: 'switch' }).click())

    expect(screen.getByText(SITE_MESSAGES.sv.welcomeHeroTitleQuote)).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.sv.welcomePillarsTitle)).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.sv.welcomeFooterParishNetwork)).toBeTruthy()
    expect(screen.queryByText(SITE_MESSAGES.en.welcomeHeroTitleQuote)).toBeNull()
  })
})
