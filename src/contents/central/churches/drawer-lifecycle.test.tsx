import type { ChurchDetail } from '@/models/central-church'
import { renderWithProviders } from '@/test/frontend/render'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  canLifecycle: true,
  canDelete: true,
}))

vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    updateAny: (subject: string) => ({
      granted: subject === 'prayer_church_lifecycle' ? m.canLifecycle : false,
    }),
    updateOwn: () => ({ granted: false }),
    deleteAny: (subject: string) => ({
      granted: subject === 'prayer_church' ? m.canDelete : false,
    }),
    deleteOwn: () => ({ granted: false }),
  }),
}))

vi.mock('@/hooks/data/central', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/data/central')>()
  return {
    ...actual,
    usePurgeCentralChurch: () => ({ onPurge: vi.fn(), loading: false }),
  }
})

import DrawerLifecycle from './drawer-lifecycle'

const makeChurch = (overrides: Partial<ChurchDetail> = {}): ChurchDetail => ({
  id: 'ch1',
  orgNodeId: 'node1',
  name: 'Example Church',
  status: 'APPROVED',
  timezone: 'Europe/Tallinn',
  description: 'A church',
  denomination: 'Lutheran',
  church_style: 'Traditional',
  latitude: 58.385,
  longitude: 24.501,
  sunday_live_stream: true,
  taize_chants: false,
  youth_ministry: true,
  country: 'Estonia',
  countryCode: 'EE',
  organization: ['Tallinn Diocese'],
  approvedAt: '2026-10-02T00:00:00.000Z',
  version: 2,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
})

describe('DrawerLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.canLifecycle = true
    m.canDelete = true
  })

  it('renders footer for APPROVED church: Suspend visible, Approve absent, Archive visible, Approved note shown', () => {
    const onLifecycle = vi.fn()
    renderWithProviders(
      <DrawerLifecycle church={makeChurch({ status: 'APPROVED' })} onLifecycle={onLifecycle} />,
    )

    expect(screen.getByRole('button', { name: 'Suspend' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.getByRole('button', { name: /archive/i })).toBeTruthy()
    expect(screen.getByText(/Approved on/)).toBeTruthy()
    expect(screen.getByText(/Archiving removes the church/)).toBeTruthy()
  })

  it('renders footer for PENDING church: Approve and Delete church visible, Suspend absent', () => {
    const onLifecycle = vi.fn()
    renderWithProviders(
      <DrawerLifecycle church={makeChurch({ status: 'PENDING' })} onLifecycle={onLifecycle} />,
    )

    expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete church' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Suspend' })).toBeNull()
    expect(screen.getByRole('button', { name: /archive/i })).toBeTruthy()
    expect(screen.queryByText(/Approved on/)).toBeNull()
  })

  it('renders footer for ARCHIVED church: Unarchive visible, Archive and Suspend absent', () => {
    const onLifecycle = vi.fn()
    renderWithProviders(
      <DrawerLifecycle church={makeChurch({ status: 'ARCHIVED' })} onLifecycle={onLifecycle} />,
    )

    expect(screen.getByRole('button', { name: 'Unarchive' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Suspend' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete church' })).toBeNull()
  })

  it('renders footer for SUSPENDED church: Unsuspend visible, Suspend and Approve absent', () => {
    const onLifecycle = vi.fn()
    renderWithProviders(
      <DrawerLifecycle church={makeChurch({ status: 'SUSPENDED' })} onLifecycle={onLifecycle} />,
    )

    expect(screen.getByRole('button', { name: 'Unsuspend' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Suspend' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.getByRole('button', { name: /archive/i })).toBeTruthy()
  })

  it('triggers onLifecycle with suspend action after modal confirm', async () => {
    const user = userEvent.setup()
    const onLifecycle = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(
      <DrawerLifecycle
        church={makeChurch({ status: 'APPROVED', version: 2 })}
        onLifecycle={onLifecycle}
      />,
    )

    const suspendBtn = screen.getByRole('button', { name: 'Suspend' })
    await user.click(suspendBtn)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/stops being publicly available/)).toBeTruthy()

    await user.click(within(dialog).getByRole('button', { name: 'Suspend' }))
    await waitFor(() => {
      expect(onLifecycle).toHaveBeenCalledWith({ action: 'suspend', version: 2 })
    })
  })

  it('triggers onLifecycle with unsuspend action after modal confirm', async () => {
    const user = userEvent.setup()
    const onLifecycle = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(
      <DrawerLifecycle
        church={makeChurch({ status: 'SUSPENDED', version: 2 })}
        onLifecycle={onLifecycle}
      />,
    )

    const unsuspendBtn = screen.getByRole('button', { name: 'Unsuspend' })
    await user.click(unsuspendBtn)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/becomes publicly available again/)).toBeTruthy()

    await user.click(within(dialog).getByRole('button', { name: 'Unsuspend' }))
    await waitFor(() => {
      expect(onLifecycle).toHaveBeenCalledWith({ action: 'unsuspend', version: 2 })
    })
  })
})
