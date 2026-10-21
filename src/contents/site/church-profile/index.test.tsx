import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { axiosMock, renderWithProviders, resolveGet, sessionMock } from '@/test/frontend/render'
import ContentsSiteChurchProfile from './index'

vi.mock('@/components/common/google-map', () => ({
  GoogleMapPins: ({
    points,
  }: {
    points: { id: string; latitude: number; longitude: number }[]
  }) => (
    <div data-testid="gm-pins" data-count={points.length}>
      {points.map((p) => (
        <span key={p.id}>
          {p.id}:{p.latitude},{p.longitude}
        </span>
      ))}
    </div>
  ),
}))
const church = {
  id: 'c1',
  name: 'Grace',
  denomination: 'Lutheran',
  description: 'A historic parish in the heart of the city.',
  timezone: 'Europe/Tallinn',
  address: {
    line1: 'Main St 1',
    line2: null,
    city: 'Tallinn',
    postalCode: '10111',
    countryCode: 'EE',
  },
  coordinates: {
    latitude: 59.437,
    longitude: 24.7536,
  },
  contacts: {
    email: 'office@grace.ee',
    phone: '+372 123 4567',
  },
  website: 'https://grace.ee',
  socialLinks: [],
  accessibility: 'Wheelchair access',
  coverAssetId: null,
  coverUrl: 'https://cdn.test/cover.jpg',
  languageCodes: ['et', 'en'],
  pastorName: 'Pastor Demo Tamm',
  pastorRole: 'Lead Pastor & Deanery Provost',
  serviceTimes: [
    {
      weekday: 1,
      localTime: '10:00',
      label: null,
      languageCode: 'et',
    },
    {
      weekday: 2,
      localTime: '10:00',
      label: null,
      languageCode: 'et',
    },
    {
      weekday: 6,
      localTime: '11:00',
      label: 'Saturday Vigil',
      languageCode: 'et',
    },
    {
      weekday: 7,
      localTime: '09:00',
      label: 'Sunday Eucharist Service',
      languageCode: 'et',
    },
  ],
  distanceKm: 1.2,
}

function renderProfile(churchId = 'c1') {
  return renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteChurchProfile churchId={churchId} />
    </SiteI18nProvider>,
  )
}

describe('ContentsSiteChurchProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockReturnValue({
      data: { user: { user_id: 'u1' } },
      status: 'authenticated',
    })
  })

  it('renders hero: church name (h1), denomination, description, distance, city, and Directions link', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet(church),
    })

    renderProfile()

    // H1 church name
    const heading = await screen.findByRole('heading', { level: 1, name: 'Grace' })
    expect(heading).toBeTruthy()

    // Denomination chip and text
    expect(screen.getAllByText('Lutheran').length).toBeGreaterThan(0)

    // Description
    expect(
      screen.getAllByText('A historic parish in the heart of the city.').length,
    ).toBeGreaterThan(0)

    // Distance and city
    expect(screen.getByText('1.2 km')).toBeTruthy()
    expect(screen.getAllByText(/Tallinn/).length).toBeGreaterThan(0)

    // Directions link with maps url
    const directionsLinks = screen.getAllByRole('link', { name: /directions/i })
    expect(directionsLinks[0].getAttribute('href')).toContain('google.com/maps')
    expect(directionsLinks[0].getAttribute('href')).toContain('59.437')
  })

  it('renders sanctuary hours card showing hours are unlisted when no devotion data exists', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet(church),
    })

    renderProfile()

    expect(await screen.findByText('Sanctuary Hours for Private Devotion')).toBeTruthy()
    expect(screen.getByText('Hours unlisted')).toBeTruthy()
    expect(
      screen.getByText('Sanctuary devotion hours are not currently listed for this parish.'),
    ).toBeTruthy()
  })

  it('renders parish welcome card with real church description and pastor attribution from API', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet(church),
    })

    renderProfile()

    expect(await screen.findByText("Pastor's Welcome")).toBeTruthy()
    expect(
      screen.getAllByText('A historic parish in the heart of the city.').length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('Pastor Demo Tamm')).toBeTruthy()
    expect(screen.getByText('Lead Pastor & Deanery Provost • Lutheran')).toBeTruthy()
  })

  it('renders empty description state when church description is absent', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet({
        ...church,
        description: null,
        pastorName: null,
      }),
    })

    renderProfile()

    expect(await screen.findByText('Parish description is not currently listed.')).toBeTruthy()
    expect(screen.getByText('About the Parish')).toBeTruthy()
  })

  it('shows unlisted empty states for sections lacking backing data', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet(church),
    })

    renderProfile()

    expect(
      await screen.findByText('No upcoming gatherings or events scheduled at this time.'),
    ).toBeTruthy()
    expect(
      screen.getByText('Diaconal community programs are not currently listed for this parish.'),
    ).toBeTruthy()
    expect(screen.getByText('Pastoral staff directory is not currently listed.')).toBeTruthy()
    expect(screen.getByText('No active parish notices or announcements at this time.')).toBeTruthy()
  })

  it('renders real worship schedule rows with weekday, time, timezone, and language badge', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet(church),
    })

    renderProfile()

    // Wait for worship services card
    expect(await screen.findByText('Worship Services & Regular Liturgies')).toBeTruthy()
    const worshipSection = screen
      .getByText('Worship Services & Regular Liturgies')
      .closest('section')!

    // Real services from fixture
    expect(within(worshipSection).getByText('Sunday Eucharist Service')).toBeTruthy()
    expect(within(worshipSection).getByText('Saturday Vigil')).toBeTruthy()
    expect(within(worshipSection).getByText('09:00 • Europe/Tallinn')).toBeTruthy()
    expect(within(worshipSection).getByText('11:00 • Europe/Tallinn')).toBeTruthy()

    // No fake filter buttons (Eucharist, Contemplative)
    expect(within(worshipSection).queryByRole('button', { name: 'Eucharist' })).toBeNull()
    expect(within(worshipSection).queryByRole('button', { name: 'Contemplative' })).toBeNull()
  })

  it('submits intercession hub prayer and shows success alert', async () => {
    const user = userEvent.setup()
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet(church),
    })

    renderProfile()

    expect(await screen.findByText('Parish Intercession Hub')).toBeTruthy()

    const nameInput = screen.getByLabelText('Name')
    const prayerInput = screen.getByLabelText('Your Prayer')
    const confidentialCheckbox = screen.getByRole('checkbox', {
      name: 'Keep confidential (Pastors only)',
    })

    await user.type(nameInput, 'Anna')
    await user.type(prayerInput, 'Peace in the world and healing for my family.')
    await user.click(confidentialCheckbox)
    expect((confidentialCheckbox as HTMLInputElement).checked).toBe(true)

    const submitBtn = screen.getByRole('button', { name: 'Offer Prayer' })
    await user.click(submitBtn)

    expect(await screen.findByText('Your prayer intention has been received.')).toBeTruthy()
  })

  it('handles stewardship amount selection, custom input, and disabled donation CTA', async () => {
    const user = userEvent.setup()
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet(church),
    })

    renderProfile()

    expect(await screen.findByText('Parish Stewardship')).toBeTruthy()

    // Default €10 selected
    const btn10 = screen.getByRole('button', { name: '€10' })
    expect(btn10.getAttribute('aria-pressed')).toBe('true')

    // Click €50 preset
    const btn50 = screen.getByRole('button', { name: '€50' })
    await user.click(btn50)
    expect(btn50.getAttribute('aria-pressed')).toBe('true')
    expect(btn10.getAttribute('aria-pressed')).toBe('false')

    // Type custom amount
    const customInput = screen.getByPlaceholderText(/custom amount/i)
    await user.type(customInput, '75')
    expect(btn50.getAttribute('aria-pressed')).toBe('false')

    // WB-41: the CTA hands off to the church's real donate page.
    expect(screen.getByRole('link', { name: 'Donate' }).getAttribute('href')).toBe('/donate/c1')
  })

  it('renders pastoral care office contact links with tel: and mailto: hrefs', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet(church),
    })

    renderProfile()

    expect(await screen.findByText('Pastoral Care Office')).toBeTruthy()

    const emailLink = screen.getByRole('link', { name: 'office@grace.ee' })
    expect(emailLink.getAttribute('href')).toBe('mailto:office@grace.ee')

    const phoneLink = screen.getByRole('link', { name: '+372 123 4567' })
    expect(phoneLink.getAttribute('href')).toBe('tel:+372 123 4567')
  })

  it('renders facilities card with real accessibility string as first feature row', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet(church),
    })

    renderProfile()

    expect(await screen.findByText('Sanctuary Facilities & Access')).toBeTruthy()
    expect(screen.getByText('Wheelchair access')).toBeTruthy()
  })

  it('renders scripture banner with quote and uppercase reference', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet(church),
    })

    renderProfile()

    expect(
      await screen.findByText('“Where two or three gather in my name, there am I with them.”'),
    ).toBeTruthy()
    expect(screen.getByText(/MATTHEW 18:20/i)).toBeTruthy()
  })

  it('renders cover image when coverUrl is provided', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet({
        ...church,
        coverUrl: 'https://cdn.test/cover.jpg',
      }),
    })

    renderProfile()

    const imgs = await screen.findAllByRole('img', { name: 'Grace' })
    expect(imgs.length).toBeGreaterThanOrEqual(1)
  })

  it('falls back to default church image when coverUrl fails to load', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet({
        ...church,
        coverUrl: 'https://cdn.test/broken-cover.jpg',
      }),
    })

    renderProfile()

    const heroImg = await screen.findByRole('img', { name: 'Grace' })
    expect(heroImg.getAttribute('src')).toContain('broken-cover.jpg')

    fireEvent.error(heroImg)

    const fallbackImg = await screen.findByRole('img', { name: 'Grace' })
    expect(fallbackImg.getAttribute('src')).toContain('/images/church.jpeg')
  })

  it('renders not found state when church does not exist or is not approved', async () => {
    const error404 = Object.assign(new Error('Request failed with status code 404'), {
      isAxiosError: true,
      response: { status: 404 },
    })
    axiosMock.get.mockRejectedValueOnce(error404)

    renderProfile()

    expect(await screen.findByText('Church not found')).toBeTruthy()
  })

  it('renders generic error state and retries on button click', async () => {
    const user = userEvent.setup()
    axiosMock.get.mockRejectedValueOnce(new Error('boom'))

    renderProfile()

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy()

    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet(church),
    })

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Grace' })).toBeTruthy()
    })
  })

  it('links to the church donate page', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet(church) })

    renderProfile()

    expect(await screen.findByRole('heading', { level: 1, name: 'Grace' })).toBeTruthy()

    expect(screen.getByRole('link', { name: 'Donate' }).getAttribute('href')).toBe('/donate/c1')
  })

  it('renders sanctuary hours badge with real hours string when present', async () => {
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return { data: resolveGet({ ...church, sanctuaryHours: '10:00–18:30 daily' }) }
    })

    renderProfile()

    expect(await screen.findByRole('heading', { level: 1, name: 'Grace' })).toBeTruthy()
    expect(screen.getAllByText('10:00–18:30 daily').length).toBeGreaterThan(0)
  })

  it('renders upcoming gatherings events with title, formatted date, location, and join link', async () => {
    const mockEvents = [
      {
        id: 'ev1',
        churchId: 'c1',
        category: 'WORSHIP',
        title: 'Choral Evensong',
        description: 'Evening prayer and choral music',
        startsAt: '2026-10-25T17:00:00.000Z',
        location: 'West Choir',
        registrationUrl: 'https://example.com/join-service',
        languageCode: 'et',
      },
      {
        id: 'ev2',
        churchId: 'c1',
        category: 'PRAYER',
        title: 'Silent Meditation',
        description: 'Midday prayer',
        startsAt: '2026-10-26T12:00:00.000Z',
        location: 'Side Chapel',
        registrationUrl: null,
        languageCode: null,
      },
    ]

    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet(mockEvents, 2) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return { data: resolveGet(church) }
    })

    renderProfile()

    expect(await screen.findByText('Choral Evensong')).toBeTruthy()
    expect(screen.getByText('Silent Meditation')).toBeTruthy()
    expect(screen.getByText(/West Choir/)).toBeTruthy()
    expect(screen.getByText(/Side Chapel/)).toBeTruthy()

    const joinLink = screen.getByRole('link', { name: /join service/i })
    expect(joinLink.getAttribute('href')).toBe('https://example.com/join-service')
    expect(joinLink.getAttribute('target')).toBe('_blank')

    expect(screen.getAllByRole('link', { name: /join service/i })).toHaveLength(1)
  })

  it('renders sanctuary gallery tiles with captions from data.gallery', async () => {
    const mockGallery = [
      {
        assetId: 'g1',
        url: 'https://cdn.test/altar.jpg',
        caption: 'Altar & stained glass',
        orderIndex: 0,
      },
      {
        assetId: 'g2',
        url: 'https://cdn.test/organ.jpg',
        caption: 'Historic organ pipe',
        orderIndex: 1,
      },
    ]

    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return { data: resolveGet({ ...church, gallery: mockGallery }) }
    })

    renderProfile()

    expect(await screen.findByText('Altar & stained glass')).toBeTruthy()
    expect(screen.getByText('Historic organ pipe')).toBeTruthy()
  })

  it('falls back to cover image when gallery tile image fails to load', async () => {
    const mockGallery = [
      {
        assetId: 'g1',
        url: 'https://cdn.test/broken-tile.jpg',
        caption: 'Altar & stained glass',
        orderIndex: 0,
      },
    ]

    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return {
        data: resolveGet({
          ...church,
          coverUrl: '/images/st-johns-church.jpeg',
          gallery: mockGallery,
        }),
      }
    })

    renderProfile()

    const tileImg = await screen.findByAltText('Altar & stained glass')
    expect(tileImg.getAttribute('src')).toContain('broken-tile.jpg')

    fireEvent.error(tileImg)

    expect(tileImg.getAttribute('src')).toContain('/images/st-johns-church.jpeg')
  })

  it('falls back to coverUrl tile when gallery is empty and coverUrl is present', async () => {
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return {
        data: resolveGet({ ...church, gallery: [], coverUrl: 'https://cdn.test/cover.jpg' }),
      }
    })

    renderProfile()

    expect(await screen.findByText('Grace — Sanctuary')).toBeTruthy()
  })

  it('renders noGalleryPhotos empty state when both gallery and coverUrl are absent', async () => {
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return { data: resolveGet({ ...church, gallery: [], coverUrl: null }) }
    })

    renderProfile()

    expect(await screen.findByText('No sanctuary photographs currently available.')).toBeTruthy()
  })

  it('renders pastoral care staff rows from data.staff', async () => {
    const mockStaff = [
      {
        name: 'Pastor Jaan Tammsalu',
        pastoralRole: 'Provost',
        imageUrl: 'https://cdn.test/jaan.jpg',
      },
      { name: 'Diaconus Mark', pastoralRole: 'Community Care', imageUrl: null },
    ]

    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return { data: resolveGet({ ...church, staff: mockStaff }) }
    })

    renderProfile()

    expect(await screen.findByText('Pastor Jaan Tammsalu')).toBeTruthy()
    expect(screen.getByText('Provost')).toBeTruthy()
    expect(screen.getByText('Diaconus Mark')).toBeTruthy()
    expect(screen.getByText('Community Care')).toBeTruthy()
  })

  it('renders noStaffDirectory when data.staff is empty', async () => {
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return { data: resolveGet({ ...church, staff: [] }) }
    })

    renderProfile()

    expect(
      await screen.findByText('Pastoral staff directory is not currently listed.'),
    ).toBeTruthy()
  })

  it('renders deaneryName badge when present and hides it when null', async () => {
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return { data: resolveGet({ ...church, deaneryName: 'Tallinn Deanery' }) }
    })

    renderProfile()

    expect(await screen.findByText('Tallinn Deanery')).toBeTruthy()
  })

  it('hides deanery badge when deaneryName is null', async () => {
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return { data: resolveGet({ ...church, deaneryName: null }) }
    })

    renderProfile()

    await screen.findByRole('heading', { level: 1, name: 'Grace' })
    expect(screen.queryByText('Tallinn Deanery')).toBeNull()
  })

  it('renders notice board announcements with title, body, and date', async () => {
    const mockAnnouncements = [
      {
        id: 'a1',
        churchId: 'c1',
        title: 'Organ Restoration Project',
        body: 'The historic organ is undergoing restoration this autumn.',
        publishedAt: '2026-10-10T12:00:00.000Z',
      },
    ]

    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet(mockAnnouncements, 1) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return { data: resolveGet(church) }
    })

    renderProfile()

    expect(await screen.findByText('Organ Restoration Project')).toBeTruthy()
    expect(
      screen.getByText('The historic organ is undergoing restoration this autumn.'),
    ).toBeTruthy()
    expect(screen.getByText('10 Oct 2026')).toBeTruthy()
  })

  it('renders noNoticeBoard when announcements list is empty', async () => {
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return { data: resolveGet(church) }
    })

    renderProfile()

    expect(
      await screen.findByText('No active parish notices or announcements at this time.'),
    ).toBeTruthy()
  })

  it('renders Primary Parish chip when home.mainChurch.id matches churchId', async () => {
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: { id: 'c1' } }) }
      return { data: resolveGet(church) }
    })

    renderProfile('c1')

    expect(await screen.findByText('Primary Parish')).toBeTruthy()
  })

  it('does not render Primary Parish chip when home.mainChurch.id does not match', async () => {
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: { id: 'c999' } }) }
      return { data: resolveGet(church) }
    })

    renderProfile('c1')

    await screen.findByRole('heading', { level: 1, name: 'Grace' })
    expect(screen.queryByText('Primary Parish')).toBeNull()
  })

  it('renders guided contemplation prayers with filter tabs when prayers exist', async () => {
    const mockPrayers = [
      {
        id: 'p1',
        churchId: 'c1',
        publishedAt: '2026-10-15T00:00:00Z',
        version: {
          prayerVersionId: 'pv1',
          versionNumber: 1,
          pastorId: 'pas1',
          title: 'Peace in Uncertain Times',
          introduction:
            'Scripture meditation on Philippians 4:6–7 • Led by Pastor Daniel Carter, Hope Church',
          body: 'Do not be anxious about anything...',
          languageCode: 'et',
        },
        audio: {
          prayerAudioId: 'a1',
          assetId: 'm1',
          assetKey: 'media/c1/prayer/peace.mp3',
          assetUrl: 'https://cdn.test/media/c1/prayer/peace.mp3',
          approvedAt: '2026-10-15T00:00:00Z',
        },
      },
    ]

    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/prayers')) return { data: resolveGet(mockPrayers, 1) }
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return { data: resolveGet(church) }
    })

    renderProfile()

    expect(await screen.findByText('Peace in Uncertain Times')).toBeTruthy()
    expect(screen.getByText('GUIDED CONTEMPLATION')).toBeTruthy()
    expect(
      screen.getByText(
        'Scripture meditation on Philippians 4:6–7 • Led by Pastor Daniel Carter, Hope Church',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'All' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Eucharist' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Contemplative' })).toBeTruthy()

    // Toggle Play audio
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    window.HTMLMediaElement.prototype.pause = vi.fn()

    const playBtn = screen.getByRole('button', { name: 'Play' })
    const user = userEvent.setup()
    await user.click(playBtn)

    // Slider appears when playing
    expect(screen.getByRole('slider', { name: 'Audio progress' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()

    // Shows exactly 3 audio action buttons: Download, Transcript, and Save (no Mute button)
    expect(screen.getByRole('link', { name: 'Download Audio' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'View Transcript' })).toBeTruthy()
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    expect(saveBtn).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mute' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Unmute' })).toBeNull()

    // Toggle save
    await user.click(saveBtn)
    expect(screen.getByRole('button', { name: 'Saved' })).toBeTruthy()

    // Open transcript modal
    const transcriptBtn = screen.getByRole('button', { name: 'View Transcript' })
    await user.click(transcriptBtn)
    expect(await screen.findByText('Do not be anxious about anything...')).toBeTruthy()
  })

  it('disables playback and hides the download link when a prayer has no approved audio', async () => {
    const noAudioPrayer = [
      {
        id: 'p2',
        churchId: 'c1',
        publishedAt: '2026-10-15T00:00:00Z',
        version: {
          prayerVersionId: 'pv2',
          versionNumber: 1,
          pastorId: 'pas1',
          title: 'Text Only Prayer',
          introduction: 'Read only',
          body: 'Lord, hear us.',
          languageCode: 'et',
        },
        audio: null,
      },
    ]

    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/prayers')) return { data: resolveGet(noAudioPrayer, 1) }
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return { data: resolveGet(church) }
    })

    renderProfile()

    expect(await screen.findByText('Text Only Prayer')).toBeTruthy()
    const playBtn = screen.getByRole('button', { name: 'Audio not available' }) as HTMLButtonElement
    expect(playBtn.disabled).toBe(true)
    expect(screen.queryByRole('link', { name: 'Download Audio' })).toBeNull()
    // No sample file is substituted.
    expect(document.querySelector('audio')).toBeNull()
  })

  it('renders 5-tile gallery layout with architect attribution when 5+ images exist', async () => {
    const mock5Gallery = [
      {
        assetId: 'g1',
        url: '/images/1.jpg',
        caption: 'Central Nave & Neo-Gothic Vaults',
        orderIndex: 0,
      },
      { assetId: 'g2', url: '/images/2.jpg', caption: '1867 Walcker Pipe Organ', orderIndex: 1 },
      { assetId: 'g3', url: '/images/3.jpg', caption: 'Chancel Stained Glass', orderIndex: 2 },
      { assetId: 'g4', url: '/images/4.jpg', caption: 'Crypt Intercession Corner', orderIndex: 3 },
      {
        assetId: 'g5',
        url: '/images/5.jpg',
        caption: 'Tower & Spire over Freedom Square',
        orderIndex: 4,
      },
    ]

    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return { data: resolveGet({ ...church, gallery: mock5Gallery }) }
    })

    renderProfile()

    expect(await screen.findByText('Central Nave & Neo-Gothic Vaults')).toBeTruthy()
    expect(screen.getByText('1867 Walcker Pipe Organ')).toBeTruthy()
    expect(screen.getByText('Chancel Stained Glass')).toBeTruthy()
    expect(screen.getByText('Crypt Intercession Corner')).toBeTruthy()
    expect(screen.getByText('Tower & Spire over Freedom Square')).toBeTruthy()
    expect(screen.getByText('Constructed 1862–1867')).toBeTruthy()
    expect(screen.getByText('Architect Christoph August Gabler')).toBeTruthy()
  })

  it('renders diaconal ministry program cards with badges and leader attribution', async () => {
    const mockPrograms = [
      {
        title: 'Crypt Warm Meals & Winter Shelter',
        description: 'Operating Tuesdays and Thursdays since 1993...',
        badgeText: 'Volunteer shifts available',
        metaText: 'Led by Deacon Tiit',
        icon: 'utensils',
      },
      {
        title: 'Baltic Refugee Resettlement Circle',
        description: 'Language partner pairings...',
        badgeText: 'Active Support Network',
        metaText: '34 Families inCare',
        icon: 'users-group',
      },
    ]

    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return { data: resolveGet({ ...church, diaconalPrograms: mockPrograms }) }
    })

    renderProfile()

    expect(await screen.findByText('Crypt Warm Meals & Winter Shelter')).toBeTruthy()
    expect(screen.getByText('Operating Tuesdays and Thursdays since 1993...')).toBeTruthy()
    expect(screen.getByText('Volunteer shifts available')).toBeTruthy()
    expect(screen.getByText('Led by Deacon Tiit')).toBeTruthy()
    expect(screen.getByText('Baltic Refugee Resettlement Circle')).toBeTruthy()
    expect(screen.getByText('Active Support Network')).toBeTruthy()
    expect(screen.getByText('34 Families inCare')).toBeTruthy()
  })

  it('renders Location card with map and Directions link when church has coordinates', async () => {
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return { data: resolveGet(church) }
    })

    renderProfile()

    expect(await screen.findByRole('heading', { level: 2, name: 'Location' })).toBeTruthy()
    expect(screen.getByTestId('gm-pins')).toBeTruthy()
    expect(screen.getByTestId('gm-pins').getAttribute('data-count')).toBe('1')

    const directionsLinks = screen.getAllByRole('link', { name: 'Directions' })
    expect(directionsLinks.length).toBeGreaterThanOrEqual(1)
    const cardDirections = directionsLinks.find((l) =>
      l.getAttribute('href')?.includes('59.437%2C24.7536'),
    )
    expect(cardDirections).toBeTruthy()
  })

  it('does not render Location card when church coordinates are null', async () => {
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      return { data: resolveGet({ ...church, coordinates: null }) }
    })

    renderProfile()

    expect(await screen.findByText('Grace')).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 2, name: 'Location' })).toBeNull()
    expect(screen.queryByTestId('gm-pins')).toBeNull()
  })

  it('renders Follow button and calls follow API on click when not followed', async () => {
    const user = userEvent.setup()
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      if (url.includes('/me/churches')) return { data: resolveGet([]) }
      return { data: resolveGet(church) }
    })
    axiosMock.put.mockResolvedValueOnce({ data: resolveGet({ churchId: 'c1', isFollowed: true }) })

    renderProfile('c1')

    const followButton = await screen.findByRole('button', { name: 'Follow' })
    expect(followButton).toBeTruthy()
    expect(followButton.getAttribute('aria-pressed')).toBe('false')

    await user.click(followButton)
    expect(axiosMock.put).toHaveBeenCalledWith('/api/v1/site/me/follows/c1')
  })

  it('renders Following button and calls unfollow API on click when followed', async () => {
    const user = userEvent.setup()
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: null }) }
      if (url.includes('/me/churches')) {
        return {
          data: resolveGet([
            {
              churchId: 'c1',
              churchName: 'Grace',
              isMain: false,
              isFollowed: true,
              city: 'Tallinn',
              address: 'Main St 1',
              coverAssetId: null,
              coverUrl: null,
            },
          ]),
        }
      }
      return { data: resolveGet(church) }
    })
    axiosMock.delete.mockResolvedValueOnce({
      data: resolveGet({ churchId: 'c1', isFollowed: false }),
    })

    renderProfile('c1')

    const followingButton = await screen.findByRole('button', { name: 'Unfollow Grace' })
    expect(followingButton).toBeTruthy()
    expect(followingButton.getAttribute('aria-pressed')).toBe('true')
    expect(within(followingButton).getByText('Following')).toBeTruthy()

    await user.click(followingButton)
    expect(axiosMock.delete).toHaveBeenCalledWith('/api/v1/site/me/follows/c1')
  })

  it('disables the button when church is the primary parish', async () => {
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url.includes('/events')) return { data: resolveGet([], 0) }
      if (url.includes('/announcements')) return { data: resolveGet([], 0) }
      if (url.includes('/home')) return { data: resolveGet({ mainChurch: { id: 'c1' } }) }
      if (url.includes('/me/churches')) {
        return {
          data: resolveGet([
            {
              churchId: 'c1',
              churchName: 'Grace',
              isMain: true,
              isFollowed: true,
              city: 'Tallinn',
              address: 'Main St 1',
              coverAssetId: null,
              coverUrl: null,
            },
          ]),
        }
      }
      return { data: resolveGet(church) }
    })

    renderProfile('c1')

    const followingButton = await screen.findByRole('button', { name: 'Unfollow Grace' })
    expect((followingButton as HTMLButtonElement).disabled).toBe(true)
    expect(within(followingButton).getByText('Following')).toBeTruthy()
  })
})
