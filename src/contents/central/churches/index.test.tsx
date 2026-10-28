import { pushMock, renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ canDelete: true, onPurge: vi.fn() }))
const useCentralChurchList = vi.hoisted(() => vi.fn())
const useCountries = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/data/central', () => ({
  useCentralChurchList,
  useCountries,
  usePurgeCentralChurch: () => ({ onPurge: m.onPurge, loading: false }),
}))
vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    deleteAny: () => ({ granted: m.canDelete }),
    deleteOwn: () => ({ granted: false }),
    createAny: () => ({ granted: true }),
    createOwn: () => ({ granted: false }),
  }),
}))
vi.mock('./drawer', () => ({
  default: ({ churchId, onClose }: { churchId: string; onClose: () => void }) => (
    <div data-testid="church-drawer" data-church-id={churchId}>
      <button onClick={onClose}>Close drawer</button>
    </div>
  ),
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
    useCountries.mockReturnValue({
      data: [{ code: 'EE', name: 'Estonia', enabled: true }],
    })
    useCentralChurchList.mockReturnValue({
      data: [row(), row({ id: 'ch2', name: 'Another Church', status: 'APPROVED' })],
      total: 2,
      loading: false,
    })
  })

  it('lists churches with country, organization, status and summary line', () => {
    renderWithProviders(<ContentsCentralChurches />)

    expect(screen.getByRole('heading', { level: 1, name: 'Church administration' })).toBeTruthy()
    expect(screen.getByText('Example Church')).toBeTruthy()
    expect(screen.getAllByText('Estonia').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Tallinn Diocese / Harju Deanery').length).toBe(2)
    expect(screen.getByText('Pending')).toBeTruthy()
    expect(screen.getByText('Approved')).toBeTruthy()
    expect(screen.getByText(/Showing 1 - 2 of 2 churches/)).toBeTruthy()
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

  it('opens the detail drawer when clicking Open or church name, and does not navigate', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralChurches />)

    expect(screen.queryByTestId('church-drawer')).toBeNull()

    await user.click(screen.getAllByRole('button', { name: 'Open' })[0])
    expect(pushMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('church-drawer').getAttribute('data-church-id')).toBe('ch1')

    await user.click(screen.getByRole('button', { name: 'Close drawer' }))
    expect(screen.queryByTestId('church-drawer')).toBeNull()

    await user.click(screen.getByText('Example Church'))
    expect(screen.getByTestId('church-drawer').getAttribute('data-church-id')).toBe('ch1')
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
