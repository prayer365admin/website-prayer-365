import { PastorData } from '@/models/pastor'
import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const usePastors = vi.hoisted(() => vi.fn())
const useCentralChurches = vi.hoisted(() => vi.fn())
const usePastorStaffOptions = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/data/central', () => ({
  usePastors,
  useCentralChurches,
  usePastorStaffOptions,
}))
vi.mock('@/components/common/add-button', () => ({
  default: ({ label, onClick }: { label: string; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
}))
vi.mock('@/components/common/pastor-image', () => ({
  default: ({ name }: { name: string }) => <span aria-hidden>{name.charAt(0)}</span>,
}))
vi.mock('./drawer', () => ({
  default: ({ pastorId, onClose }: { pastorId?: string; onClose: () => void }) => (
    <div data-testid="pastor-drawer" data-mode={pastorId ?? 'create'}>
      <button type="button" onClick={onClose}>
        Close pastor drawer
      </button>
    </div>
  ),
}))

import ContentsPastor from './index'

const pastor = (overrides: Partial<PastorData> = {}): PastorData => ({
  id: 'pastor-1',
  version: 1,
  name: 'Pastor A',
  introduction: 'Chaplain at Grace',
  imageAssetId: null,
  imageChurchId: null,
  user_id: null,
  user: null,
  churches: [{ churchId: 'church-1', churchName: 'Grace Church' }],
  ...overrides,
})

const pastors = [
  pastor(),
  pastor({
    id: 'pastor-2',
    name: 'Pastor B',
    introduction: null,
    user_id: 'user-1',
    user: { id: 'user-1', name: 'Mikk Leedjärv', email: 'mikk@example.com' },
    churches: [],
  }),
]

const listResult = (overrides: Record<string, unknown> = {}) => ({
  data: pastors,
  total: pastors.length,
  loading: false,
  error: null,
  onDelete: vi.fn(),
  ...overrides,
})

describe('ContentsPastor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCentralChurches.mockReturnValue({
      data: [{ id: 'church-1', name: 'Grace Church', status: 'APPROVED' }],
      isLoading: false,
    })
    usePastorStaffOptions.mockReturnValue({
      data: [{ id: 'user-1', name: 'Mikk Leedjärv', email: 'mikk@example.com' }],
      isLoading: false,
    })
  })

  it('renders the custom pastor table with filters, rows and pagination', () => {
    usePastors.mockReturnValue(listResult())
    renderWithProviders(<ContentsPastor />)

    expect(usePastors).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10 }))
    expect(screen.getByRole('heading', { name: 'Pastors' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New Pastor' })).toBeTruthy()
    expect(screen.getByText('All Church')).toBeTruthy()
    expect(screen.getByText('All Account')).toBeTruthy()

    // Div-based table: column headers and rows, no antd table element.
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('Name (church)')).toBeTruthy()
    expect(screen.getByText('Introduction')).toBeTruthy()
    expect(screen.getByText('Staff account')).toBeTruthy()
    expect(screen.getByText('Pastor A')).toBeTruthy()
    expect(screen.getByText('Grace Church')).toBeTruthy()
    expect(screen.getByText('Mikk Leedjärv')).toBeTruthy()
    expect(screen.getByText('mikk@example.com')).toBeTruthy()

    // Unlinked staff account renders the placeholder pill.
    expect(screen.getByText('Not linked')).toBeTruthy()

    expect(screen.getByText('Showing 1 - 2 of 2 pastors')).toBeTruthy()
  })

  it('opens the drawer in create mode, then in edit mode for a row', async () => {
    const user = userEvent.setup()
    usePastors.mockReturnValue(listResult())
    renderWithProviders(<ContentsPastor />)

    expect(screen.queryByTestId('pastor-drawer')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'New Pastor' }))
    expect(screen.getByTestId('pastor-drawer').dataset.mode).toBe('create')

    await user.click(screen.getByRole('button', { name: 'Close pastor drawer' }))
    expect(screen.queryByTestId('pastor-drawer')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Edit Pastor A' }))
    expect(screen.getByTestId('pastor-drawer').dataset.mode).toBe('pastor-1')
  })

  it('shows a useful load error', () => {
    usePastors.mockReturnValue(listResult({ data: [], total: 0, error: new Error('failed') }))
    renderWithProviders(<ContentsPastor />)

    expect(screen.getByText('Pastor profiles could not be loaded')).toBeTruthy()
  })
})
