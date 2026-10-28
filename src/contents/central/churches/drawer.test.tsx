import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useCentralChurch = vi.hoisted(() => vi.fn())
const useHierarchy = vi.hoisted(() => vi.fn())
const useCreateCentralChurch = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/data/central', () => ({
  useCentralChurch,
  useHierarchy,
  useCreateCentralChurch,
  usePurgeCentralChurch: () => ({ onPurge: vi.fn(), loading: false }),
}))

vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    updateAny: () => ({ granted: true }),
    updateOwn: () => ({ granted: false }),
    deleteAny: () => ({ granted: true }),
    deleteOwn: () => ({ granted: false }),
  }),
}))

vi.mock('@/components/common/google-map', () => ({
  GoogleMapPicker: ({ label }: { label: string }) => <div aria-label={label}>Mock Map Picker</div>,
}))

import ContentsCentralChurchDrawer from './drawer'

const church = (overrides = {}) => ({
  id: 'ch1',
  orgNodeId: 'node1',
  name: 'Parnu St. Elizabeth Church',
  status: 'APPROVED',
  timezone: 'Europe/Tallinn',
  description: 'Baroque church',
  denomination: 'Lutheran',
  church_style: 'Traditional',
  latitude: 58.385,
  longitude: 24.501,
  sunday_live_stream: true,
  taize_chants: false,
  youth_ministry: true,
  country: 'Estonia',
  countryCode: 'EE',
  organization: ['Estonia Diocese', 'Pärnu Deanery'],
  approvedAt: '2026-10-25T08:05:24.000Z',
  version: 2,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
})

describe('ContentsCentralChurchDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCentralChurch.mockReturnValue({
      data: church(),
      loading: false,
      saving: false,
      error: null,
      onUpdate: vi.fn(),
      onLifecycle: vi.fn(),
    })
    useHierarchy.mockReturnValue({ data: [], loading: false })
    useCreateCentralChurch.mockReturnValue({ onCreate: vi.fn(), loading: false })
  })

  it('renders drawer header, setup form matching design, 800px width, and footer actions', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    renderWithProviders(<ContentsCentralChurchDrawer churchId="ch1" onClose={onClose} />)

    // Header content
    expect(
      screen.getByRole('heading', { level: 2, name: 'Parnu St. Elizabeth Church' }),
    ).toBeTruthy()
    expect(screen.getByText('Approved')).toBeTruthy()

    // Full profile link
    const profileLink = screen.getByRole('link', { name: 'Full Profile' })
    expect(profileLink.getAttribute('href')).toBe('/dashboard/churches/ch1/profile')

    // Manage pastors link
    const pastorsLink = screen.getByRole('link', { name: 'Manage Pastors' })
    expect(pastorsLink.getAttribute('href')).toBe('/dashboard/central/pastors')

    // Close button
    const closeBtn = screen.getByRole('button', { name: 'Close drawer' })
    await user.click(closeBtn)
    expect(onClose).toHaveBeenCalled()

    // Drawer container has width 800 (via ant-drawer-content-wrapper style width: 800px)
    const wrapper = document.querySelector<HTMLElement>('.ant-drawer-content-wrapper')
    expect(wrapper).toBeTruthy()
    expect(wrapper?.style.width).toBe('800px')

    // Form fields
    expect(screen.getByLabelText(/church name/i)).toBeTruthy()
    expect(screen.getByText(/Estonia Diocese \/ Pärnu Deanery/)).toBeTruthy()
    expect(screen.queryByLabelText(/timezone/i)).toBeNull()
    expect(screen.getByLabelText(/denomination/i)).toBeTruthy()
    expect(screen.getByLabelText(/worship style/i)).toBeTruthy()
    expect(screen.getByLabelText(/profile basics/i)).toBeTruthy()
    expect(screen.getByLabelText('Church location')).toBeTruthy()

    // Footer actions
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save setup' })).toBeTruthy()
    expect(screen.getByText(/Approved on/)).toBeTruthy()
  })

  it('renders create mode with minimal required fields when churchId is not provided', () => {
    useCentralChurch.mockReturnValue({
      data: undefined,
      loading: false,
      saving: false,
      error: null,
      onUpdate: vi.fn(),
      onLifecycle: vi.fn(),
    })

    renderWithProviders(<ContentsCentralChurchDrawer onClose={vi.fn()} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Church setup' })).toBeTruthy()
    expect(screen.getByLabelText(/church name/i)).toBeTruthy()
    expect(screen.getByLabelText('Country')).toBeTruthy()
    expect(screen.getByLabelText('Diocese')).toBeTruthy()
    expect(screen.getByLabelText('Deanery')).toBeTruthy()
    expect(screen.queryByLabelText(/timezone/i)).toBeNull()
    expect(screen.getByRole('button', { name: 'Save setup' })).toBeTruthy()
  })
})
