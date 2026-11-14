import { SiteI18nProvider } from '@/i18n/site-i18n'
import { GeneralPrayerSiteOutput } from '@/models/general-prayer'
import { SiteLoginPrayer } from '@/models/site-prayer'
import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import WelcomeHero from './hero'

/*
 * The welcome hero's listening card is where a visitor meets the platform daily
 * prayer (client decision, 13 Nov 2026). It replaced a standalone block above the
 * hero, so this asserts the card itself carries the daily prayer — and still falls
 * back to the newest church prayer when no daily prayer is published.
 */
const dailyPrayer = (
  overrides: Partial<GeneralPrayerSiteOutput> = {},
): GeneralPrayerSiteOutput => ({
  slug: 'paivapalve-2',
  sequence: 2,
  title: 'Et su silmad oleksid lahti',
  introduction: null,
  verse: 'Et su silmad oleksid lahti ööd ja päevad.',
  verseReference: '1Kn 8,29',
  liturgicalNote: null,
  body: '<p>Armas Jumal, ma tänan Sind kiriku eest.</p>',
  references: null,
  languageCode: 'et',
  audioUrl: 'https://cdn.test/general/paivapalve-2.mp3',
  durationSeconds: 25,
  ...overrides,
})

const churchPrayer = (): SiteLoginPrayer => ({
  id: 'p1',
  title: 'Tänulikkus',
  churchName: "Viimsi St James' Church",
  pastorName: 'Mikk Leedjärv',
  languageCode: 'et',
  audioUrl: 'https://cdn.test/prayers/p1.mp3',
  introduction: 'Viimsi Püha Jaakobi koguduse jutlus · 2. september 2018',
  churchCoverUrl: null,
})

const render = (props: Parameters<typeof WelcomeHero>[0]) =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <WelcomeHero {...props} />
    </SiteI18nProvider>,
  )

describe('welcome hero listening card', () => {
  it('plays the daily prayer and opens it from the card button', () => {
    render({ dailyDate: '13.11.2026', dailyPrayer: dailyPrayer(), prayer: churchPrayer() })

    // The card's only CTA is the open-prayer button (the bookmark icon is gone).
    const link = screen.getByRole('link', { name: /Open the prayer/ })
    expect(link.getAttribute('href')).toBe('/prayers/general/paivapalve-2')
    expect(screen.getByText('13.11.2026')).toBeTruthy()
    // The verse is the card's quote line, not the church prayer's introduction.
    expect(screen.getByText(/Et su silmad oleksid lahti ööd ja päevad/)).toBeTruthy()
  })

  it('keeps the newest church prayer in the card when no daily prayer exists', () => {
    render({ prayer: churchPrayer() })

    expect(screen.getByText('Tänulikkus')).toBeTruthy()
    expect(screen.getByText('Mikk Leedjärv')).toBeTruthy()
    // No daily prayer -> no button pointing at a general prayer page.
    expect(screen.queryByRole('link', { name: /Open the prayer/ })).toBeNull()
  })
})
