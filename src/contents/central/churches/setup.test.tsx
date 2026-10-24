import { renderWithProviders, replaceMock } from '@/test/frontend/render'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  canUpdate: true,
  canLifecycle: true,
  canDelete: true,
  onCreate: vi.fn(),
  onUpdate: vi.fn(),
  onLifecycle: vi.fn(),
}))

const useCentralChurch = vi.hoisted(() => vi.fn())
const useHierarchy = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/data/central', () => ({
  useCentralChurch,
  useHierarchy,
  useCreateCentralChurch: () => ({ onCreate: m.onCreate, loading: false }),
  usePurgeCentralChurch: () => ({ onPurge: vi.fn(), loading: false }),
}))
vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    updateAny: (subject: string) => ({
      granted:
        subject === 'prayer_church_lifecycle'
          ? m.canLifecycle
          : subject === 'prayer_church'
            ? m.canUpdate
            : false,
    }),
    updateOwn: () => ({ granted: false }),
    deleteAny: () => ({ granted: m.canDelete }),
    deleteOwn: () => ({ granted: false }),
  }),
}))

import ContentsCentralChurchSetup from './setup'

const church = (overrides = {}) => ({
  id: 'ch1',
  orgNodeId: 'node1',
  name: 'Example Church',
  status: 'PENDING',
  timezone: 'Europe/Tallinn',
  description: 'A church',
  denomination: 'Lutheran',
  church_style: 'Traditional',
  latitude: null,
  longitude: null,
  sunday_live_stream: false,
  taize_chants: false,
  youth_ministry: false,
  country: 'Estonia',
  countryCode: 'EE',
  organization: ['Tallinn Diocese', 'Harju Deanery'],
  approvedAt: null,
  version: 3,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
})

const hierarchy = [
  {
    id: 'g',
    kind: 'GLOBAL',
    name: 'Global',
    parentId: null,
    countryCode: null,
    version: 1,
    children: [
      {
        id: 'co',
        kind: 'COUNTRY',
        name: 'Estonia',
        parentId: 'g',
        countryCode: 'EE',
        version: 1,
        children: [
          {
            id: 'di',
            kind: 'DIOCESE',
            name: 'Tallinn Diocese',
            parentId: 'co',
            countryCode: null,
            version: 1,
            children: [
              {
                id: 'de',
                kind: 'DEANERY',
                name: 'Harju Deanery',
                parentId: 'di',
                countryCode: null,
                version: 1,
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
]

const useChurch = (overrides = {}) => ({
  data: church(),
  loading: false,
  saving: false,
  error: undefined,
  refetch: vi.fn(),
  onUpdate: m.onUpdate,
  onLifecycle: m.onLifecycle,
  ...overrides,
})

describe('ContentsCentralChurchSetup (S16)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.canUpdate = true
    m.canLifecycle = true
    m.canDelete = true
    m.onUpdate.mockResolvedValue(undefined)
    m.onLifecycle.mockResolvedValue(undefined)
    m.onCreate.mockResolvedValue({ id: 'new1', status: 'PENDING' })
    useCentralChurch.mockReturnValue(useChurch())
    useHierarchy.mockReturnValue({ data: hierarchy, loading: false })
  })

  it('shows the stored record and saves the setup with its version', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralChurchSetup churchId="ch1" />)

    expect(screen.getByText('Pending')).toBeTruthy()
    expect(screen.getByText(/Tallinn Diocese \/ Harju Deanery/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Save setup' }))

    await waitFor(() =>
      expect(m.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 3,
          name: 'Example Church',
          timezone: 'Europe/Tallinn',
        }),
      ),
    )
  })

  it('offers Approve for a pending church and confirms the visibility effect first', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralChurchSetup churchId="ch1" />)

    expect(screen.queryByRole('button', { name: 'Suspend' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Approve' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/visible in the public app/)).toBeTruthy()

    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await waitFor(() =>
      expect(m.onLifecycle).toHaveBeenCalledWith({ action: 'approve', version: 3 }),
    )
  })

  it('swaps Approve for Suspend once the church is approved, and keeps Archive', () => {
    useCentralChurch.mockReturnValue(
      useChurch({
        data: church({ status: 'APPROVED', approvedAt: '2026-10-02T00:00:00.000Z' }),
      }),
    )
    renderWithProviders(<ContentsCentralChurchSetup churchId="ch1" />)

    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Delete church' })).toBeNull()
  })

  it('hides Delete church for an approved church even with the delete grant', () => {
    useCentralChurch.mockReturnValue(useChurch({ data: church({ status: 'APPROVED' }) }))
    renderWithProviders(<ContentsCentralChurchSetup churchId="ch1" />)

    expect(screen.queryByRole('button', { name: 'Delete church' })).toBeNull()
  })

  it('creates a church under the chosen deanery and opens it', async () => {
    const user = userEvent.setup()
    useCentralChurch.mockReturnValue(useChurch({ data: undefined }))
    renderWithProviders(<ContentsCentralChurchSetup />)

    await user.type(screen.getByLabelText('Church name'), 'New Church')
    await user.click(screen.getByLabelText('Country'))
    await user.click(await screen.findByTitle('Estonia'))
    await user.click(screen.getByLabelText('Diocese'))
    await user.click(await screen.findByTitle('Tallinn Diocese'))
    await user.click(screen.getByLabelText('Deanery'))
    await user.click(await screen.findByTitle('Harju Deanery'))

    await user.click(screen.getByRole('button', { name: 'Save setup' }))

    await waitFor(() =>
      expect(m.onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Church', parentId: 'de' }),
      ),
    )
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith('/dashboard/central/churches/new1'),
    )
  })
})
