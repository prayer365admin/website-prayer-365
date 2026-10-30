import { pushMock, renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prayers = vi.hoisted(() => ({ useCentralPrayers: vi.fn() }))
const churches = vi.hoisted(() => ({ useChurches: vi.fn() }))
const pagination = vi.hoisted(() => ({
  page: 1,
  pageSize: 10,
  setPage: vi.fn(),
  setPageSize: vi.fn(),
}))

vi.mock('@/hooks/data/prayer', () => prayers)
vi.mock('@/hooks/data/church', () => churches)
vi.mock('@/hooks/ui/url-pagination', () => ({ useUrlPagination: () => pagination }))

import ContentsCentralPrayers from '.'

const prayer = (over: Record<string, unknown> = {}) => ({
  id: 'prayer-1',
  churchId: 'church-1',
  churchName: 'Viimsi Church',
  version: 1,
  createdAt: '2026-10-01T00:00:00.000Z',
  featuredAssetId: null,
  current: {
    id: 'version-1',
    versionNumber: 1,
    pastorId: 'pastor-1',
    title: 'Morning Prayer',
    introduction: null,
    body: '<p>Prayer</p>',
    languageCode: 'en',
    textHash: 'hash',
    approvedBy: null,
    approvedAt: null,
    selectedAudioId: null,
    latestAudioId: null,
    latestAudioStatus: null,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  published: { prayerVersionId: 'version-1', publishedAt: '2026-10-12T00:00:00.000Z' },
  scheduled: null,
  textApproved: true,
  ...over,
})

describe('ContentsCentralPrayers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pagination.page = 1
    pagination.pageSize = 10
    churches.useChurches.mockReturnValue({ data: [{ id: 'church-1', name: 'Viimsi Church' }] })
    prayers.useCentralPrayers.mockReturnValue({ data: [prayer()], total: 1, loading: false })
  })

  it('matches the Central Prayer list structure and opens the safe edit flow', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralPrayers />)

    expect(screen.getByRole('heading', { name: 'Prayers' })).toBeTruthy()
    expect(screen.getByPlaceholderText('Search Prayer')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Filter church' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Filter status' })).toBeTruthy()
    expect(churches.useChurches).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100, page: 1, orderBy: 'name', orderDirection: 'asc' }),
    )
    expect(screen.getByText('Published')).toBeTruthy()
    expect(screen.getByText('12 October 2026')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Edit Morning Prayer' }))
    expect(pushMock).toHaveBeenCalledWith('/dashboard/central/prayers/prayer-1')
    expect(
      screen
        .getByRole('button', { name: 'View history for Morning Prayer' })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Delete Morning Prayer' }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('opens Central creation without coupling it to the church list filter', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralPrayers />)

    await user.click(screen.getByRole('button', { name: 'New Prayer' }))

    expect(pushMock).toHaveBeenCalledWith('/dashboard/central/prayers/new')
  })

  it('shows the authorized churches in the church filter', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralPrayers />)

    await user.click(screen.getByRole('combobox', { name: 'Filter church' }))

    expect(screen.getAllByText('Viimsi Church')).toHaveLength(2)
  })

  it('continues row numbering from the URL-backed page', () => {
    pagination.page = 2
    prayers.useCentralPrayers.mockReturnValue({ data: [prayer()], total: 11, loading: false })

    renderWithProviders(<ContentsCentralPrayers />)

    expect(screen.getByRole('cell', { name: '11' })).toBeTruthy()
    expect(prayers.useCentralPrayers).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, limit: 10 }),
    )
  })
})
