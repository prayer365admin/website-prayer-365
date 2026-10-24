import { pushMock, renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ canDelete: true, onPurge: vi.fn() }))
const useCentralChurchList = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/data/central', () => ({
  useCentralChurchList,
  usePurgeCentralChurch: () => ({ onPurge: m.onPurge, loading: false }),
}))
vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    deleteAny: () => ({ granted: m.canDelete }),
    deleteOwn: () => ({ granted: false }),
  }),
}))
vi.mock('@/components/common/dashboard/main-header', () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
vi.mock('@/components/common/search-input', () => ({
  default: () => <input aria-label="Search" />,
}))

import ContentsCentralChurches from './index'

const row = (overrides = {}) => ({
  id: 'ch1',
  orgNodeId: 'node1',
  name: 'Example Church',
  status: 'PENDING',
  timezone: 'Europe/Tallinn',
  description: null,
  denomination: null,
  church_style: null,
  country: 'Estonia',
  countryCode: 'EE',
  organization: ['Tallinn Diocese', 'Harju Deanery'],
  version: 1,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
})

describe('ContentsCentralChurches (S15)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.canDelete = true
    m.onPurge.mockResolvedValue(undefined)
    useCentralChurchList.mockReturnValue({
      data: [row(), row({ id: 'ch2', name: 'Another Church', status: 'APPROVED' })],
      total: 2,
      loading: false,
    })
  })

  it('lists churches with country, organization and state', () => {
    renderWithProviders(<ContentsCentralChurches />)

    expect(screen.getByText('Example Church')).toBeTruthy()
    expect(screen.getAllByText('Estonia').length).toBe(2)
    expect(screen.getAllByText('Tallinn Diocese / Harju Deanery').length).toBe(2)
    expect(screen.getByText('Pending')).toBeTruthy()
    expect(screen.getByText('Approved')).toBeTruthy()
  })

  it('offers Delete only for a pending church', () => {
    renderWithProviders(<ContentsCentralChurches />)

    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1)
  })

  it('hides Delete without the delete grant', () => {
    m.canDelete = false
    renderWithProviders(<ContentsCentralChurches />)

    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('opens the detail screen from a row', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralChurches />)

    await user.click(screen.getAllByRole('button', { name: 'Open' })[0])
    expect(pushMock).toHaveBeenCalledWith('/dashboard/central/churches/ch1')
  })

  it('requires the exact church name before purging, then sends the version', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralChurches />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    const confirm = (await screen.findByRole('button', {
      name: 'Delete church',
    })) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)

    await user.type(screen.getByPlaceholderText('Example Church'), 'Example Churc')
    expect(confirm.disabled).toBe(true)

    await user.type(screen.getByPlaceholderText('Example Church'), 'h')
    expect(confirm.disabled).toBe(false)

    await user.click(confirm)
    expect(m.onPurge).toHaveBeenCalledWith({
      churchId: 'ch1',
      payload: { version: 1, confirmName: 'Example Church' },
    })
  })
})
