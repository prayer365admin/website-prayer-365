import { SiteI18nProvider } from '@/i18n/site-i18n'
import { MobileHome } from '@/models/mobile'
import { axiosMock, renderWithProviders } from '@/test/frontend/render'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ContentsSiteHome from '.'
import { eventIcs } from './gatherings'
import PrayerPetition from './petition'

const home = (audioUrl: string | null = null): MobileHome => ({
  mainChurch: null,
  followedChurches: [],
  latestEvents: [],
  latestAnnouncements: [],
  latestPrayers: [
    {
      id: 'prayer-1',
      slug: 'peace-in-uncertain-times',
      churchId: 'church-1',
      churchName: 'Hope Church',
      publishedAt: '2026-10-15T06:00:00.000Z',
      version: {
        prayerVersionId: 'version-1',
        versionNumber: 1,
        pastorId: 'pastor-1',
        pastorName: 'Daniel Mäkinen',
        title: 'Peace in uncertain times',
        introduction: 'A reflection for today',
        body: 'Do not be anxious about anything.',
        languageCode: 'en',
      },
      audio: audioUrl
        ? {
            prayerAudioId: 'audio-1',
            assetId: 'asset-1',
            assetKey: 'audio/prayer.mp3',
            assetUrl: audioUrl,
            approvedAt: '2026-10-15T05:00:00.000Z',
          }
        : null,
    },
  ],
})

const mainChurch = {
  id: 'church-1',
  name: 'Hope Church',
  denomination: null,
  description: 'Open daily for silent adoration',
  timezone: 'Europe/Tallinn',
  address: {
    line1: 'Vabaduse väljak 1',
    line2: null,
    city: 'Tallinn',
    postalCode: null,
    countryCode: 'EE',
  },
  coordinates: { latitude: 59.4, longitude: 24.7 },
  contacts: { email: null, phone: null },
  website: null,
  socialLinks: [],
  accessibility: null,
  coverAssetId: null,
  coverUrl: null,
  languageCodes: ['et'],
  serviceTimes: [
    { weekday: 7, localTime: '10:00', label: 'Sunday Divine Service', languageCode: 'et' },
  ],
  distanceKm: null,
} as unknown as NonNullable<MobileHome['mainChurch']>

const event = {
  id: 'event-1',
  churchId: 'church-1',
  category: 'SERVICE',
  title: 'Trinity Sunday Festival Worship',
  description: 'Organ prelude; choir',
  startsAt: '2026-06-01T07:00:00.000Z',
  location: 'Main Nave',
  registrationUrl: 'https://example.com/rsvp',
  languageCode: 'et',
}

const renderHome = (
  data: MobileHome,
  gift: Parameters<typeof ContentsSiteHome>[0]['gift'] = null,
  readyPrayers = 0,
  nextGiftAt: Date | null = null,
) =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteHome
        gift={gift}
        home={data}
        nextGiftAt={nextGiftAt}
        readyPrayers={readyPrayers}
        name="Anna Example"
        now="2026-10-15T08:00:00.000Z"
        userId="u1"
      />
    </SiteI18nProvider>,
  )

const renderPetition = () =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <PrayerPetition church={mainChurch} />
    </SiteI18nProvider>,
  )

describe('WB3 Home devotional hero', () => {
  it('disables every player control except Read transcript without approved audio', () => {
    renderHome(home())

    expect(screen.getByRole('heading', { name: /Good morning, Anna/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Peace in uncertain times' })).toBeTruthy()
    expect(screen.getByText('Daniel Mäkinen')).toBeTruthy()
    expect(screen.getAllByText('Hope Church').length).toBeGreaterThan(0)
    for (const name of [
      'Play prayer audio',
      'Go back 10 seconds',
      'Go forward 10 seconds',
      'Playback speed 1 times',
      'Mute prayer audio',
      'Download prayer audio',
    ]) {
      // Disabled through the surrounding <fieldset disabled>, so check :disabled, not the attribute.
      expect(screen.getByRole('button', { name }).matches(':disabled')).toBe(true)
    }
    expect(screen.getByLabelText('Prayer audio position').matches(':disabled')).toBe(true)
    expect(screen.getByRole('link', { name: /Read transcript/i }).getAttribute('href')).toBe(
      '/prayers/peace-in-uncertain-times',
    )
  })

  it('shows the functional player only when approved audio has a public URL', () => {
    const { container } = renderHome(home('https://cdn.example.com/audio/prayer.mp3'))

    expect(screen.getByRole('button', { name: 'Play prayer audio' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Download prayer audio' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Read transcript/i }).getAttribute('href')).toBe(
      '/prayers/peace-in-uncertain-times',
    )

    const audio = container.querySelector('audio') as HTMLAudioElement
    Object.defineProperty(audio, 'duration', { configurable: true, value: 328 })
    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 164, writable: true })
    fireEvent.loadedMetadata(audio)
    fireEvent.timeUpdate(audio)

    expect(screen.getByText('5:28')).toBeTruthy()
    expect(screen.getByTestId('audio-progress').getAttribute('style')).toContain('width: 50%')
  })

  it('hides the prayer share and love actions on the homepage', () => {
    renderHome(home())

    const quotePanel = screen.getByAltText('Misty Nordic lake at sunrise').parentElement!
    expect(within(quotePanel).queryByRole('button', { name: 'Share prayer' })).toBeNull()
    expect(
      within(quotePanel).queryByRole('button', {
        name: 'Saving prayers is not available yet',
      }),
    ).toBeNull()

    const scripture = screen
      .getByRole('heading', { name: 'Scripture of the day' })
      .closest('section')!
    expect(within(scripture).queryByRole('button', { name: 'Share scripture' })).toBeNull()
    expect(
      within(scripture).queryByRole('button', {
        name: 'Saving prayers is not available yet',
      }),
    ).toBeNull()
  })

  it('renders the directory empty state when no eligible prayer exists', () => {
    renderHome({ ...home(), latestPrayers: [] })

    expect(screen.getByRole('heading', { name: 'No prayers yet from your churches' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to church directory' }).getAttribute('href')).toBe(
      '/churches',
    )
  })

  it('shows the ready prayer count on the Daily Prayer card', () => {
    renderHome(home(), null, 5)

    expect(screen.getByRole('link', { name: /Daily Prayer/ }).textContent).toContain(
      '5 Sessions Ready',
    )
  })

  it('uses the singular label when one prayer is ready', () => {
    renderHome(home(), null, 1)

    expect(screen.getByRole('link', { name: /Daily Prayer/ }).textContent).toContain(
      '1 Session Ready',
    )
  })

  it('links available shortcuts and marks unbuilt ones as coming soon', () => {
    renderHome(home())

    expect(screen.getByRole('link', { name: /Daily Prayer/ }).getAttribute('href')).toBe('/prayers')
    expect(screen.getByRole('link', { name: /Find Churches/ }).getAttribute('href')).toBe(
      '/churches',
    )
    expect(screen.getByRole('heading', { name: 'Sunday Services' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Sunday Services/ })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Request Prayer' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Request Prayer/ })).toBeNull()
    expect(screen.getAllByText('Coming soon')).toHaveLength(2)
    expect(screen.queryByLabelText('Your Prayer Request')).toBeNull()
  })

  it('points Directions at the parish address when coordinates are missing', () => {
    renderHome({
      ...home(),
      mainChurch: {
        ...mainChurch,
        coordinates: null,
        address: { ...mainChurch.address, city: '' },
      },
    })

    // Empty parts (blank city, null postal code) are dropped instead of leaving ", ," gaps.
    const href = screen.getByRole('link', { name: /Directions/ }).getAttribute('href')!
    expect(new URL(href).searchParams.get('destination')).toBe('Vabaduse väljak 1, EE')
  })

  it('renders the main parish, its services, and the active gift without events', () => {
    renderHome(
      { ...home(), mainChurch, latestEvents: [event] },
      {
        amountMinor: 1000,
        currency: 'EUR',
        churchId: 'church-1',
        churchName: 'Hope Church',
      },
      0,
      new Date('2026-11-15T00:00:00.000Z'),
    )

    expect(screen.getByRole('heading', { name: 'Hope Church' })).toBeTruthy()
    const parish = screen.getByRole('region', { name: 'Hope Church' })
    const detailLinks = within(parish).getAllByRole('link', { name: 'Hope Church' })
    expect(detailLinks).toHaveLength(2)
    expect(detailLinks.every((link) => link.getAttribute('href') === '/churches/church-1')).toBe(
      true,
    )
    expect(within(parish).queryByRole('button', { name: 'Bulletin' })).toBeNull()
    expect(screen.getByText('Every Sunday @ 10:00 (ET)')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Directions/ }).getAttribute('href')).toContain(
      'destination=59.4%2C24.7',
    )
    expect(screen.queryByRole('heading', { name: event.title })).toBeNull()
    expect(screen.queryByRole('link', { name: 'RSVP' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save Date' })).toBeNull()
    expect(screen.getByText('€10')).toBeTruthy()
    expect(screen.getByText('Beneficiary: Hope Church')).toBeTruthy()
    expect(screen.getByText('Next: November 15, 2026')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Manage Giving/ }).getAttribute('href')).toBe(
      '/donate/church-1',
    )
    expect(screen.getByRole('link', { name: 'One-time Offering' }).getAttribute('href')).toBe(
      '/donate/church-1?frequency=one_time',
    )
  })

  it('keeps event actions hidden when the home response contains events', () => {
    renderHome({ ...home(), mainChurch, latestEvents: [event] })

    expect(screen.queryByRole('heading', { name: event.title })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save Date' })).toBeNull()
  })

  it('escapes calendar text and assumes a one-hour slot', () => {
    const ics = eventIcs(event)
    expect(ics).toContain('DTSTART:20260601T070000Z')
    expect(ics).toContain('DTEND:20260601T080000Z')
    expect(ics).toContain('DESCRIPTION:Organ prelude\\; choir')
  })

  it('sends a confidential prayer petition to the main church', async () => {
    let finish = () => {}
    axiosMock.post.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ data: { result: { id: 'r1', kind: 'prayer', createdAt: '' } } })
        }),
    )
    renderPetition()

    fireEvent.click(screen.getByRole('button', { name: 'Family & Peace' }))
    fireEvent.change(screen.getByLabelText('Your Prayer Request'), {
      target: { value: 'Please pray for my mother.' },
    })
    fireEvent.click(screen.getByLabelText('Keep confidential (Pastors only)'))
    fireEvent.click(screen.getByRole('button', { name: /Send to Prayer Team/ }))
    expect(await screen.findByTestId('petition-sending')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Send to Prayer Team/ }).getAttribute('aria-busy'),
    ).toBe('true')
    finish()

    await waitFor(() =>
      expect(screen.getByText('Your prayer request was sent to Hope Church.')).toBeTruthy(),
    )
    expect(screen.queryByTestId('petition-sending')).toBeNull()
    const [url, body, config] = axiosMock.post.mock.calls[0]
    expect(url).toBe('/api/v1/site/churches/church-1/requests')
    expect(body).toEqual({
      kind: 'prayer',
      subject: 'Family & Peace',
      message: 'Please pray for my mother.',
      classification: 'PRIVATE',
      contactMethod: 'in_app',
    })
    expect(config.headers['Idempotency-Key']).toBeTruthy()
  })

  it('hides the petition and shows parish setup without a main church', () => {
    renderHome(home())

    expect(screen.queryByLabelText('Your Prayer Request')).toBeNull()
    expect(screen.getByRole('link', { name: 'Open profile' }).getAttribute('href')).toBe(
      '/customer',
    )
    expect(screen.getByText('No active monthly gift yet.')).toBeTruthy()
    // No gift and no main parish: giving starts from the church directory.
    expect(screen.getByRole('link', { name: /Manage Giving/ }).getAttribute('href')).toBe(
      '/churches',
    )
  })

  it('shows the real prayer-listening streak and minutes listened this week', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <ContentsSiteHome
          habits={{ streakDays: 4, minutesThisWeek: 48 }}
          home={home()}
          name="Anna Example"
          now="2026-10-15T08:00:00.000Z"
          userId="u1"
        />
      </SiteI18nProvider>,
    )

    expect(screen.getByText('Days in prayer').previousElementSibling?.textContent).toBe('4')
    expect(screen.getByText('mins This week').previousElementSibling?.textContent).toBe('48')
  })
})
