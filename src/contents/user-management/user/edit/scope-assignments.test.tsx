import { renderWithProviders } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useRoleAssignments = vi.hoisted(() => vi.fn())
const useHierarchy = vi.hoisted(() => vi.fn())
const useRoles = vi.hoisted(() => vi.fn())
const granted = vi.hoisted(() => ({ value: true }))
vi.mock('@/hooks/data/central', () => ({ useRoleAssignments, useHierarchy }))
vi.mock('@/hooks/data/role', () => ({ useRoles }))
vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    readAny: () => ({ granted: granted.value }),
    createAny: () => ({ granted: granted.value }),
    deleteAny: () => ({ granted: granted.value }),
  }),
}))

import ScopeAssignments from './scope-assignments'

describe('ScopeAssignments', () => {
  const onRevoke = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    granted.value = true
    useRoleAssignments.mockReturnValue({
      data: [
        {
          id: 'a-1',
          role_key: 'prayer_church_admin',
          org_node_name: 'St Mary',
          created_at: '2026-10-01T00:00:00.000Z',
        },
      ],
      loading: false,
      saving: false,
      onCreate: vi.fn(),
      onRevoke,
    })
    useHierarchy.mockReturnValue({ data: [] })
    useRoles.mockReturnValue({ data: [] })
  })

  it('lists the user assignments and revokes after confirmation', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ScopeAssignments userId="staff-1" />)

    expect(useRoleAssignments).toHaveBeenCalledWith(expect.objectContaining({ userId: 'staff-1' }))
    expect(screen.getByText('St Mary')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Revoke' }))
    expect(onRevoke).not.toHaveBeenCalled()
    const confirm = await screen.findAllByRole('button', { name: 'Revoke' })
    await user.click(confirm[confirm.length - 1])
    await waitFor(() => expect(onRevoke).toHaveBeenCalledWith('a-1'))
  })

  it('renders nothing without assignment read permission', () => {
    granted.value = false
    const { container } = renderWithProviders(<ScopeAssignments userId="staff-1" />)
    expect(container.textContent).toBe('')
  })
})
