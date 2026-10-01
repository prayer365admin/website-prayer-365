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
  announcementCount: 0,
  memberCount: 40,
  mediaCount: 1,
}

const overview = {
  church: {
    id: 'c1',
    name: 'Grace',
    status: 'APPROVED',
    timezone: 'Europe/Tallinn',
    city: 'Tallinn',
    version: 3,
  },
  aggregates,
}

const overviewWithRequests = {
  ...overview,
  requests: {
    total: 7,
    recent: [
      {
        id: 'q1',
        kind: 'PRAYER',
        classification: 'STANDARD',
        createdAt: '2026-09-30T00:00:00.000Z',
      },
    ],
  },
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

  it('renders title, subtitle, and metric cards', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet(overview) })
    renderWithProviders(<ContentsChurchOverview />)

    await screen.findByText('Church overview')
    expect(screen.getByText('Your church at a glance.')).toBeTruthy()

    await screen.findByText('Followers')
    expect(screen.getByText('40')).toBeTruthy()

    expect(screen.getByText('Prayer reads')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()

    expect(screen.getByText('Confirmed donations')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()

    expect(axiosMock.get).toHaveBeenCalledTimes(1)
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/admin/churches/c1/overview')
  })

  it('renders action cards and respective counts correctly', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet(overview) })
    renderWithProviders(<ContentsChurchOverview />)

    await screen.findByText("Today's prayer")
    await screen.findByText('5 prayers')

    expect(screen.getByText('Next service')).toBeTruthy()
    await screen.findByText('2 service times scheduled')

    expect(screen.getByText('Upcoming events')).toBeTruthy()
    await screen.findByText('3 events')
  })

  it('hides recent requests when missing from the server payload', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet(overview) })
    renderWithProviders(<ContentsChurchOverview />)

    await screen.findByText('Church overview')
    expect(screen.queryByText('Recent requests')).toBeFalsy()
    expect(screen.queryByRole('button', { name: 'Open requests' })).toBeFalsy()
  })

  it('shows recent requests when included in the server payload', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet(overviewWithRequests) })
    renderWithProviders(<ContentsChurchOverview />)

    await screen.findByText('Recent requests')
    await screen.findByText('7 requests')
    expect(screen.getByText(/PRAYER/)).toBeTruthy()
    expect(screen.getByText(/STANDARD/)).toBeTruthy()
  })

  it('navigates to specific sub-routes when action buttons are clicked', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet(overviewWithRequests) })
    renderWithProviders(<ContentsChurchOverview />)

    const user = userEvent.setup()

    const profileBtn = await screen.findByRole('button', { name: 'Edit profile' })
    await user.click(profileBtn)
    expect(pushMock).toHaveBeenCalledWith('/dashboard/churches/c1/profile')

    const prayerBtn = screen.getByRole('button', { name: 'Open prayer' })
    await user.click(prayerBtn)
    expect(pushMock).toHaveBeenCalledWith('/dashboard/churches/c1/prayers')

    const scheduleBtn = screen.getByRole('button', { name: 'View schedule' })
    await user.click(scheduleBtn)
    expect(pushMock).toHaveBeenCalledWith('/dashboard/churches/c1/profile')

    const eventsBtn = screen.getByRole('button', { name: 'Open events' })
    await user.click(eventsBtn)
    expect(pushMock).toHaveBeenCalledWith('/dashboard/churches/c1/events')

    const requestsBtn = screen.getByRole('button', { name: 'Open requests' })
    await user.click(requestsBtn)
    expect(pushMock).toHaveBeenCalledWith('/dashboard/churches/c1/requests')
  })
})
