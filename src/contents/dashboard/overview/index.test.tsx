import { renderWithProviders, sessionMock } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useCentralChurches = vi.hoisted(() => vi.fn())
const useCentralVoiceProfiles = vi.hoisted(() => vi.fn())
const useCentralPrayers = vi.hoisted(() => vi.fn())
const useChurches = vi.hoisted(() => vi.fn())
const useChurchOverview = vi.hoisted(() => vi.fn())
const useMyVoiceSubmissions = vi.hoisted(() => vi.fn())
const useMyVoiceChurches = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/data/central', () => ({ useCentralChurches }))
vi.mock('@/hooks/data/voice', () => ({
  useCentralVoiceProfiles,
  useMyVoiceSubmissions,
  useMyVoiceChurches,
}))
vi.mock('@/hooks/data/prayer', () => ({ useCentralPrayers }))
vi.mock('@/hooks/data/church', () => ({ useChurches, useChurchOverview }))

import ContentsOverview from './index'

const churchRows = [
  { id: 'c1', name: 'Grace', status: 'APPROVED' },
  { id: 'c2', name: 'Hope', status: 'PENDING' },
  { id: 'c3', name: 'Faith', status: 'PENDING' },
]

const churchOverview = {
  church: { id: 'c1', name: 'Grace', timezone: 'UTC' },
  aggregates: { prayerCount: 12, pastorCount: 3, announcementPublishedCount: 8 },
}

const link = (container: HTMLElement, name: RegExp) =>
  Array.from(container.querySelectorAll('a')).find((a) => name.test(a.textContent ?? ''))

const linkHref = (container: HTMLElement, name: RegExp) =>
  link(container, name)?.getAttribute('href')

describe('ContentsOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useChurches.mockReturnValue({ data: churchRows, total: 3, loading: false })
    useChurchOverview.mockReturnValue({ data: churchOverview, loading: false })
    useCentralChurches.mockReturnValue({ data: churchRows, isLoading: false })
    useCentralVoiceProfiles.mockReturnValue({ data: [], total: 7, loading: false })
    useCentralPrayers.mockReturnValue({ data: [], total: 9, loading: false })
    useMyVoiceSubmissions.mockReturnValue({ data: [], total: 0, loading: false })
    useMyVoiceChurches.mockReturnValue({ data: [], loading: false })
    sessionMock.mockReturnValue(undefined)
  })

  it('renders the central KPI grid and navigate panel from live counts', () => {
    renderWithProviders(<ContentsOverview variant="central" />)

    expect(screen.getByRole('heading', { name: 'Central Admin' })).toBeTruthy()
    expect(screen.getByText('Churches')).toBeTruthy()
    expect(screen.getByText('Awaiting Church approval')).toBeTruthy()
    expect(screen.getByText('Voice review Pending')).toBeTruthy()
    expect(screen.getByText('Prayers to review')).toBeTruthy()

    // Churches total, pending churches, voice total, prayer total.
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByText('9')).toBeTruthy()

    expect(screen.getByRole('heading', { name: 'Navigate to' })).toBeTruthy()
    for (const label of ['My Church', 'All Prayers', 'Voice Profiles', 'Staff Accounts']) {
      expect(screen.getByText(label)).toBeTruthy()
    }

    expect(
      screen.getByRole('link', { name: /Awaiting Church approval/ }).getAttribute('href'),
    ).toBe('/dashboard/central/churches?status=PENDING')
  })

  it('shows a dash while counts are loading', () => {
    useCentralChurches.mockReturnValue({ data: undefined, isLoading: true })
    useCentralVoiceProfiles.mockReturnValue({ data: [], total: 0, loading: true })
    useCentralPrayers.mockReturnValue({ data: [], total: 0, loading: true })

    renderWithProviders(<ContentsOverview variant="central" />)

    expect(screen.getAllByText('—')).toHaveLength(4)
  })

  it('scopes the home dashboard to the first accessible church', () => {
    const { container } = renderWithProviders(<ContentsOverview variant="home" />)

    expect(screen.getByText('Grace')).toBeTruthy()
    expect(screen.getAllByText('My Churches')).toHaveLength(2)
    expect(screen.getByText('Prayers')).toBeTruthy()
    expect(screen.getByText('Pastors')).toBeTruthy()
    expect(screen.getByText('Published announcements')).toBeTruthy()

    // Accessible churches, selected church prayers / pastors / announcements.
    expect(link(container, /^My Churches/)?.textContent).toContain('3')
    expect(link(container, /^Prayers/)?.textContent).toContain('12')
    expect(link(container, /^Pastors/)?.textContent).toContain('3')
    expect(link(container, /^Published announcements/)?.textContent).toContain('8')

    expect(linkHref(container, /^Prayers/)).toBe('/dashboard/churches/c1/prayers')
    expect(linkHref(container, /^Pastors/)).toBe('/dashboard/churches/c1/profile')
    expect(linkHref(container, /^Published announcements/)).toBe(
      '/dashboard/churches/c1/announcements',
    )
    expect(linkHref(container, /^Church profile/)).toBe('/dashboard/churches/c1/profile')
    expect(linkHref(container, /^My Voice/)).toBe('/dashboard/my-voice')
  })

  it('falls back to dashes and the churches list when nothing is assigned', () => {
    useChurches.mockReturnValue({ data: [], total: 0, loading: false })
    useChurchOverview.mockReturnValue({ data: undefined, loading: false })

    const { container } = renderWithProviders(<ContentsOverview variant="home" />)

    expect(screen.getByText('No churches assigned')).toBeTruthy()
    expect(screen.getAllByText('—')).toHaveLength(3)
    expect(linkHref(container, /^Church profile/)).toBe('/dashboard/churches')
  })
  it('gives a pastor their own voice submissions instead of church aggregates', () => {
    sessionMock.mockReturnValue({
      data: { user: { user_id: 'u1', role: { name: 'prayer_pastor' } } },
      status: 'authenticated',
    })
    useMyVoiceSubmissions.mockReturnValue({
      data: [
        { id: 'v1', reviewState: 'SUBMITTED' },
        { id: 'v2', reviewState: 'SUBMITTED' },
        { id: 'v3', reviewState: 'APPROVED' },
        { id: 'v4', reviewState: 'REJECTED' },
      ],
      total: 4,
      loading: false,
    })
    useMyVoiceChurches.mockReturnValue({
      data: [
        { id: 'c1', name: 'Grace' },
        { id: 'c2', name: 'Hope' },
      ],
      loading: false,
    })

    const { container } = renderWithProviders(<ContentsOverview variant="home" />)

    expect(link(container, /^My voice profiles/)?.textContent).toContain('4')
    expect(link(container, /^In review/)?.textContent).toContain('2')
    expect(link(container, /^Approved/)?.textContent).toContain('1')
    expect(link(container, /^Needs revision/)?.textContent).toContain('1')

    // No church-admin aggregates or church picker for a pastor.
    expect(screen.queryByText('Published announcements')).toBeNull()
    expect(container.querySelector('.ant-select')).toBeNull()

    expect(linkHref(container, /^Grace/)).toBe('/dashboard/churches/c1')
    expect(linkHref(container, /^Hope/)).toBe('/dashboard/churches/c2')
  })
})
