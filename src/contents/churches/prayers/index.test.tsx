import { describe, beforeEach, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axiosMock, pushMock, renderWithProviders, resolveGet } from '@/test/frontend/render'
import { PrayerOutput } from '@/models/prayer'
import ContentsChurchesPrayers from './index'
const mockPrayers: PrayerOutput[] = [
  {
    id: 'p1',
    churchId: 'c1',
    version: 1,
    createdAt: '2024-12-01T08:00:00Z',
    current: {
      id: 'pv1',
      versionNumber: 1,
      pastorId: 'pastor-1',
      title: 'Morning prayer',
      introduction: null,
      body: 'Hello world',
      languageCode: 'en',
      textHash: 'hash1',
      approvedBy: null,
      approvedAt: null,
      selectedAudioId: null,
      latestAudioId: null,
      latestAudioStatus: null,
      createdAt: '2024-12-01T08:00:00Z',
    },
    scheduled: {
      prayerVersionId: 'pv1',
      scheduledAt: '2025-01-01T08:00:00Z',
    },
    published: null,
    textApproved: false,
  },
  {
    id: 'p2',
    churchId: 'c1',
    version: 1,
    createdAt: '2024-11-01T08:00:00Z',
    current: {
      id: 'pv2',
      versionNumber: 1,
      pastorId: 'pastor-2',
      title: 'Prayer of thanks',
      introduction: null,
      body: 'Thank you Lord',
      languageCode: 'en',
      textHash: 'hash2',
      approvedBy: 'admin',
      approvedAt: '2024-11-01T09:00:00Z',
      selectedAudioId: null,
      latestAudioId: null,
      latestAudioStatus: null,
      createdAt: '2024-11-01T08:00:00Z',
    },
    scheduled: null,
    published: {
      prayerVersionId: 'pv2',
      publishedAt: '2024-11-01T10:00:00Z',
    },
    textApproved: true,
  },
]

describe('ContentsChurchesPrayers', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
    pushMock.mockClear()
  })

  it('renders rows, publication info, and create action', async () => {
    axiosMock.get.mockResolvedValue({ data: resolveGet(mockPrayers, 2) })

    renderWithProviders(<ContentsChurchesPrayers churchId="c1" />)

    // Table entries
    await screen.findByText('Morning prayer')
    expect(screen.getByText('Prayer of thanks')).toBeTruthy()

    // Publication info
    expect(screen.getByText(/Scheduled •/)).toBeTruthy()
    expect(screen.getByText(/Published •/)).toBeTruthy()

    // Create action
    expect(screen.getByRole('button', { name: /new prayer/i })).toBeTruthy()

    // Verify initial load
    expect(axiosMock.get).toHaveBeenCalledWith(
      expect.stringContaining(
        '/api/v1/admin/churches/c1/prayers?page=1&limit=10&order_by=created_at&order_direction=desc',
      ),
    )
  })

  it('navigates to editor route on row Open', async () => {
    axiosMock.get.mockResolvedValue({ data: resolveGet(mockPrayers, 2) })

    renderWithProviders(<ContentsChurchesPrayers churchId="c1" />)

    await screen.findByText('Morning prayer')

    const openButtons = screen.getAllByRole('button', { name: 'Open' })
    await userEvent.click(openButtons[0])

    expect(pushMock).toHaveBeenCalledWith('/dashboard/churches/c1/prayers/p1')
  })

  it('refetches by publication order when Published archive tab is clicked', async () => {
    axiosMock.get.mockResolvedValue({ data: resolveGet(mockPrayers, 2) })

    renderWithProviders(<ContentsChurchesPrayers churchId="c1" />)

    await screen.findByText('Morning prayer')

    await userEvent.click(screen.getByRole('tab', { name: /published archive/i }))

    await waitFor(() => {
      expect(axiosMock.get).toHaveBeenCalledWith(expect.stringContaining('order_by=published_at'))
    })
  })
})
