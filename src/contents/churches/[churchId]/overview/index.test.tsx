import {
  axiosMock,
  pushMock,
  renderWithProviders,
  resolveGet,
  sessionMock,
} from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ContentsChurchOverview from './index'

const aggregates = {
  serviceTimeCount: 2,
  pastorCount: 1,
  prayerCount: 5,
  eventCount: 3,
  announcementDraftCount: 4,
  announcementPublishedCount: 6,
  memberCount: 40,
  mediaCount: 1,
}

const church = {
  id: 'c1',
  name: 'Grace Church',
  status: 'APPROVED',
  timezone: 'Europe/Tallinn',
  city: 'Tallinn',
  version: 3,
}

const overview = {
  church,
  aggregates,
}

const overviewWithRequests = {
  ...overview,
  requests: {
    total: 1,
    recent: [
      {
        id: 'q1',
        kind: 'prayer',
        classification: 'standard',
        subject: 'Healing and Peace',
        createdAt: '2026-09-30T00:00:00.000Z',
      },
    ],
  },
}

const profile = {
  id: 'c1',
  name: 'Grace Church',
  heroAssetId: null,
  version: 3,
}

const donationSummary = {
  month: '2026-04',
  currencies: [
    {
      currency: 'usd',
      grossMinor: '240000',
      refundedMinor: '0',
      netMinor: '240000',
    },
  ],
}

const pastors = [
  {
    id: 'p1',
    name: 'Pastor John',
    title: 'Senior Pastor',
    imageAssetId: null,
    imageChurchId: 'c1',
  },
]

const prayers = [
  {
    id: 'pr1',
    churchId: 'c1',
    current: {
      id: 'pr-cur-1',
      body: 'May the Lord be with you always.',
    },
  },
]

const serviceTimes = [
  {
    id: 'st1',
    weekday: 7, // Sunday
    localTime: '10:00:00',
    label: 'Sunday Service',
  },
]

const events = [
  {
    id: 'ev1',
    title: 'Spring Festival',
    startsAt: '2026-05-01T10:00:00.000Z',
  },
]

const announcements = [
  {
    id: 'an1',
    churchId: 'c1',
    title: 'Community Gathering',
    body: 'Join us this Friday for fellowship.',
    publishedAt: '2026-04-20T10:00:00.000Z',
  },
]

const setupMocks = (customOverview = overview) => {
  axiosMock.get.mockImplementation(async (url: string) => {
    if (url.includes('/overview')) return { data: resolveGet(customOverview) }
    if (url.includes('/profile')) return { data: resolveGet(profile) }
    if (url.includes('/donation-summary')) return { data: resolveGet(donationSummary) }
    if (url.includes('/pastors')) return { data: resolveGet(pastors) }
    if (url.includes('/prayers')) return { data: resolveGet(prayers) }
    if (url.includes('/service-times')) return { data: resolveGet(serviceTimes) }
    if (url.includes('/events')) return { data: resolveGet(events) }
    if (url.includes('/announcements')) return { data: resolveGet(announcements) }
    return { data: resolveGet([]) }
  })
}

describe('ContentsChurchOverview', () => {
  beforeEach(() => {
    sessionMock.mockReturnValue({
      data: { user: { role: { id: 'r1', name: 'Church administrator' } } },
      status: 'authenticated',
    })
  })

  afterEach(() => {
    sessionMock.mockReset()
    axiosMock.get.mockReset()
    pushMock.mockReset()
  })

  it('renders hero title, Manage button, and KPI cards with real numbers', async () => {
    setupMocks()
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchOverview />)

    // Hero title
    await screen.findByRole('heading', { level: 1, name: 'Grace Church' })

    // Manage button in hero
    const manageBtn = screen.getByRole('button', { name: 'Manage' })
    await user.click(manageBtn)
    expect(pushMock).toHaveBeenCalledWith('/dashboard/churches/c1/profile')

    // KPI cards
    expect(screen.getByText('Followers')).toBeTruthy()
    expect(screen.getByText('40')).toBeTruthy()

    expect(screen.getByText('Prayer reads')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()

    expect(screen.getByText('Confirmed donations')).toBeTruthy()
    await screen.findByText('USD 2,400.00')
  })

  it('renders Today’s Prayer and Next Service rows correctly', async () => {
    setupMocks()
    renderWithProviders(<ContentsChurchOverview />)

    // Today's Prayer card
    await screen.findByText('Pastor John')
    expect(screen.getByText("Today's Prayer")).toBeTruthy()
    expect(screen.getByText('Model: —')).toBeTruthy()
    expect(screen.getByText('NUMBERS 6:24-26')).toBeTruthy()
    expect(screen.getByText('May the Lord be with you always.')).toBeTruthy()

    // Next Service card
    expect(screen.getByText('Next Service')).toBeTruthy()
    await screen.findByText('Sunday')
    expect(screen.getByText('10:00')).toBeTruthy()
    expect(screen.getByText('Sunday Service')).toBeTruthy()
  })

  it('renders Upcoming events and Announcements with dummy category chip', async () => {
    setupMocks()
    renderWithProviders(<ContentsChurchOverview />)

    // Upcoming events
    await screen.findByText('Spring Festival')
    expect(screen.getByText('Upcoming events')).toBeTruthy()

    // Announcements
    await screen.findByText('Community Gathering')
    expect(screen.getByText('Announcements')).toBeTruthy()
    expect(screen.getByText('Church notice')).toBeTruthy()
    expect(screen.getByText('Join us this Friday for fellowship.')).toBeTruthy()
  })

  it('hides recent requests when missing from server payload', async () => {
    setupMocks(overview)
    renderWithProviders(<ContentsChurchOverview />)

    await screen.findByText('Donations')
    expect(screen.queryByText('Recent requests')).toBeFalsy()
  })

  it('shows recent requests when included in server payload', async () => {
    setupMocks(overviewWithRequests)
    renderWithProviders(<ContentsChurchOverview />)

    await screen.findByText('Recent requests')
    expect(screen.getByText('Prayer request')).toBeTruthy()
    expect(screen.getByText('Standard')).toBeTruthy()
  })

  it('routes correctly when action buttons and links are clicked', async () => {
    setupMocks(overviewWithRequests)
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchOverview />)
    await screen.findByRole('heading', { level: 1, name: 'Grace Church' })
    await screen.findByText('Pastor John')
    await screen.findByText('Sunday')
    await screen.findByText('Spring Festival')
    await screen.findByText('Community Gathering')
    await screen.findByText('Recent requests')
    // Open donations CTA
    const donationBtn = screen.getByRole('button', { name: 'Open donations' })
    await user.click(donationBtn)
    expect(pushMock).toHaveBeenCalledWith('/dashboard/churches/c1/donations')

    // Today's prayer "Open"
    const openPrayerBtn = screen.getByRole('button', { name: 'Open' })
    await user.click(openPrayerBtn)
    expect(pushMock).toHaveBeenCalledWith('/dashboard/churches/c1/prayers')

    // "View all" buttons
    const viewAllButtons = screen.getAllByRole('button', { name: 'View all' })
    // Next service
    await user.click(viewAllButtons[0])
    expect(pushMock).toHaveBeenCalledWith('/dashboard/churches/c1/profile')

    // Upcoming events
    await user.click(viewAllButtons[1])
    expect(pushMock).toHaveBeenCalledWith('/dashboard/churches/c1/events')

    // Announcements
    await user.click(viewAllButtons[2])
    expect(pushMock).toHaveBeenCalledWith('/dashboard/churches/c1/announcements')

    // Recent requests
    await user.click(viewAllButtons[3])
    expect(pushMock).toHaveBeenCalledWith('/dashboard/churches/c1/requests')
  })
})
