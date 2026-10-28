import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axiosMock, renderWithProviders, resolveGet } from '@/test/frontend/render'
import EditUserModal from './edit-user-modal'

const testUser = {
  id: 'r1',
  name: 'Alice',
  email: 'alice@x.com',
  role_id: 'role-1',
  profile_picture: null,
  role: {
    id: 'role-1',
    name: 'Parish Lead',
  },
}

const testRoles = [
  {
    id: 'role-1',
    name: 'Parish Lead',
    type: 'USER',
    permission: [
      {
        id: 'p1',
        subject: 'prayer_church',
        actions: 'update',
        scope: 'ANY',
      },
    ],
  },
]

const testAssignments = [
  {
    id: 'ra-1',
    user_id: 'r1',
    user_email: 'alice@x.com',
    user_name: 'Alice',
    role_id: 'role-1',
    role_key: 'Parish Lead',
    org_node_id: 'node-1',
    org_node_name: 'United Kingdom',
    granted_by: 'admin',
    created_at: '2025-01-01T00:00:00.000Z',
    revoked_at: null,
  },
]

const testHierarchy = [
  {
    id: 'node-1',
    name: 'United Kingdom',
    kind: 'COUNTRY',
    parentId: null,
    countryCode: 'GB',
    version: 1,
    children: [
      {
        id: 'node-2',
        name: 'Diocese of London',
        kind: 'DIOCESE',
        parentId: 'node-1',
        countryCode: 'GB',
        version: 1,
        children: [],
      },
    ],
  },
]

describe('EditUserModal', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
    axiosMock.put.mockClear()
    axiosMock.post.mockClear()
  })

  it('renders prefilled user data and View & Approve for granted module', async () => {
    axiosMock.get.mockImplementation((url: unknown) => {
      const urlStr = String(url)
      if (urlStr.includes('/api/v1/users/r1')) {
        return Promise.resolve({ data: { result: testUser } })
      }
      if (urlStr.includes('/api/v1/roles')) {
        return Promise.resolve({ data: resolveGet(testRoles, 1) })
      }
      if (urlStr.includes('/role-assignments')) {
        return Promise.resolve({ data: resolveGet(testAssignments, 1) })
      }
      if (urlStr.includes('/hierarchy')) {
        return Promise.resolve({ data: { result: testHierarchy } })
      }
      return Promise.resolve({ data: resolveGet([], 0) })
    })

    renderWithProviders(
      <EditUserModal open={true} userId="r1" onClose={vi.fn()} onSaved={vi.fn()} />,
    )

    const nameInput = (await screen.findByLabelText(/^Name/i)) as HTMLInputElement
    expect(nameInput.value).toBe('Alice')

    const emailInput = screen.getByLabelText(/^Email/i) as HTMLInputElement
    expect(emailInput.value).toBe('alice@x.com')

    expect(screen.getAllByText('Parish Lead').length).toBeGreaterThan(0)
    expect(screen.getByText('View & Approve')).toBeTruthy()
  })

  it('calls axiosMock.put with user data on Save Changes', async () => {
    axiosMock.get.mockImplementation((url: unknown) => {
      const urlStr = String(url)
      if (urlStr.includes('/api/v1/users/r1')) {
        return Promise.resolve({ data: { result: testUser } })
      }
      if (urlStr.includes('/api/v1/roles')) {
        return Promise.resolve({ data: resolveGet(testRoles, 1) })
      }
      if (urlStr.includes('/role-assignments')) {
        return Promise.resolve({ data: resolveGet(testAssignments, 1) })
      }
      if (urlStr.includes('/hierarchy')) {
        return Promise.resolve({ data: { result: testHierarchy } })
      }
      return Promise.resolve({ data: resolveGet([], 0) })
    })

    axiosMock.put.mockResolvedValueOnce({ data: { result: testUser } })

    const onSaved = vi.fn()
    const onClose = vi.fn()

    renderWithProviders(
      <EditUserModal open={true} userId="r1" onClose={onClose} onSaved={onSaved} />,
    )

    await screen.findByDisplayValue('Alice')
    const saveButton = screen.getByRole('button', { name: /save changes/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(axiosMock.put).toHaveBeenCalledWith(
        '/api/v1/users/r1',
        expect.objectContaining({
          name: 'Alice',
          email: 'alice@x.com',
          role_id: 'role-1',
        }),
      )
    })

    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
