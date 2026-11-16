import { SiteI18nProvider } from '@/i18n/site-i18n'
import { GeneralPrayerSiteOutput } from '@/models/general-prayer'
import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import GeneralPrayerDetail from './detail'

/*
 * Both copy fields are optional and both are easy to lose on the way from the row
 * to the DOM (they are absent from the DTO, or the block is dropped in a refactor),
 * so assert them by text rather than by markup.
 */
const prayer = (overrides: Partial<GeneralPrayerSiteOutput> = {}): GeneralPrayerSiteOutput => ({
  slug: 'paivapalve-4',
  sequence: 4,
  title: 'Nad võivad elada julgelt',
  introduction: null,
  verse: 'Ma olen hea karjane',
  verseReference: 'Jh 10,11',
  liturgicalNote: null,
  body: '<p>Issand, hoia meid oma armus.</p>',
  references: 'Hs 34,28',
  languageCode: 'et',
  audioUrl: null,
  durationSeconds: null,
  ...overrides,
})

const render = (data: GeneralPrayerSiteOutput) =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <GeneralPrayerDetail prayer={data} sentOn="16.11.2026" />
    </SiteI18nProvider>,
  )

describe('general prayer reader', () => {
  it('renders the introduction as a lead-in above the prayer text', () => {
    render(prayer({ introduction: '<p>See palve avab pühapäeva teema.</p>' }))

    expect(screen.getByText('See palve avab pühapäeva teema.')).toBeTruthy()
  })

  it('renders the liturgical note for the Sundays that carry one', () => {
    render(prayer({ liturgicalNote: 'EELVIIMANE PÜHAPÄEV KIRIKUAASTAS' }))

    expect(screen.getByText('EELVIIMANE PÜHAPÄEV KIRIKUAASTAS')).toBeTruthy()
  })

  it('renders nothing extra when both fields are empty', () => {
    render(prayer())

    expect(screen.getByRole('heading', { name: 'Nad võivad elada julgelt' })).toBeTruthy()
    expect(screen.queryByText('EELVIIMANE PÜHAPÄEV KIRIKUAASTAS')).toBeNull()
  })
})
