import { SiteI18nProvider } from '@/i18n/site-i18n'
import { MobileHome } from '@/models/mobile'
import { axiosMock, renderWithProviders } from '@/test/frontend/render'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ContentsSiteHome from '.'
import { eventIcs } from './gatherings'

const home = (audioUrl: string | null = null): MobileHome => ({
  mainChurch: null,
  followedChurches: [],
  latestEvents: [],
  latestAnnouncements: [],
  latestPrayers: [
    {
      id: 'prayer-1',
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
            url: audioUrl,
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
) =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteHome
        gift={gift}
        home={data}
        name="Anna Example"
        now="2026-10-15T08:00:00.000Z"
      />
    </SiteI18nProvider>,
  )

describe('WB3 Home devotional hero', () => {
  it('renders live prayer attribution and a text-only action without approved audio', () => {
    renderHome(home())

    expect(screen.getByRole('heading', { name: /Good morning, Anna/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Peace in uncertain times' })).toBeTruthy()
    expect(screen.getByText('Daniel Mäkinen')).toBeTruthy()
    expect(screen.getAllByText('Hope Church').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Read prayer' }).getAttribute('href')).toBe(
      '/prayers/prayer-1',
    )
    expect(screen.queryByRole('button', { name: 'Play prayer audio' })).toBeNull()
  })

  it('shows the functional player only when approved audio has a public URL', () => {
    const { container } = renderHome(home('https://cdn.example.com/audio/prayer.mp3'))

    expect(screen.getByRole('button', { name: 'Play prayer audio' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Download prayer audio' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Read transcript/i }).getAttribute('href')).toBe(
      '/prayers/prayer-1',
    )

    const audio = container.querySelector('audio') as HTMLAudioElement
    Object.defineProperty(audio, 'duration', { configurable: true, value: 328 })
    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 164, writable: true })
    fireEvent.loadedMetadata(audio)
    fireEvent.timeUpdate(audio)

    expect(screen.getByText('5:28')).toBeTruthy()
    expect(screen.getByTestId('audio-progress').getAttribute('style')).toContain('width: 50%')
  })

  it('renders the directory empty state when no eligible prayer exists', () => {
    renderHome({ ...home(), latestPrayers: [] })

    expect(screen.getByRole('heading', { name: 'No prayers yet from your churches' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to church directory' }).getAttribute('href')).toBe(
      '/churches',
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
    expect(screen.queryByRole('link', { name: /Request Prayer/ })).toBeNull()
    expect(screen.getAllByText('Coming soon')).toHaveLength(2)
  })

  it('renders the main parish, its services, events, and the active gift', () => {
    renderHome(
      { ...home(), mainChurch, latestEvents: [event] },
      {
        amountMinor: 1000,
        currency: 'EUR',
        churchId: 'church-1',
        churchName: 'Hope Church',
      },
    )

    expect(screen.getByRole('heading', { name: 'Hope Church' })).toBeTruthy()
    expect(screen.getByText('Every Sunday @ 10:00 (ET)')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Directions/ }).getAttribute('href')).toContain(
      'destination=59.4%2C24.7',
    )
    expect(screen.getByRole('heading', { name: event.title })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'RSVP' }).getAttribute('href')).toBe(
      event.registrationUrl,
    )
    expect(screen.getByRole('button', { name: 'Save Date' })).toBeTruthy()
    expect(screen.getByText('€10')).toBeTruthy()
    expect(screen.getByText('Beneficiary: Hope Church')).toBeTruthy()
  })

  it('downloads the event .ics only on click (nothing time-dependent in the SSR markup)', async () => {
    const created: Blob[] = []
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob)
      return 'blob:event'
    })
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderHome({ ...home(), mainChurch, latestEvents: [event] })

    fireEvent.click(screen.getByRole('button', { name: 'Save Date' }))

    expect(click).toHaveBeenCalledTimes(1)
    expect(await created[0].text()).toContain('SUMMARY:Trinity Sunday Festival Worship')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:event')
    click.mockRestore()
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
    renderHome({ ...home(), mainChurch })

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

  it('disables the petition and shows parish setup without a main church', () => {
    renderHome(home())

    expect(screen.getByText('Choose a main church to send prayer requests.')).toBeTruthy()
    expect(
      (screen.getByLabelText('Your Prayer Request') as HTMLTextAreaElement).closest('fieldset')
        ?.disabled,
    ).toBe(true)
    expect(screen.getByRole('link', { name: 'Open profile' }).getAttribute('href')).toBe(
      '/customer',
    )
    expect(screen.getByText('No active monthly gift yet.')).toBeTruthy()
  })

  it('shows the real check-in streak and minutes listened this week', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <ContentsSiteHome
          habits={{ streakDays: 4, minutesThisWeek: 48 }}
          home={home()}
          name="Anna Example"
          now="2026-10-15T08:00:00.000Z"
        />
      </SiteI18nProvider>,
    )

    expect(screen.getByText('Days in prayer').previousElementSibling?.textContent).toBe('4')
    expect(screen.getByText('mins This week').previousElementSibling?.textContent).toBe('48')
  })
})
