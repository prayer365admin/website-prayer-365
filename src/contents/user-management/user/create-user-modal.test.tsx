import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axiosMock, renderWithProviders, resolveGet } from '@/test/frontend/render'
import CreateUserModal from './create-user-modal'

const testRoles = [
  {
    id: 'role-1',
    name: 'Parish Lead',
    type: 'USER',
    permission: [{ id: 'p1', subject: 'prayer_church', actions: 'update', scope: 'ANY' }],
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

const mockReads = () => {
  axiosMock.get.mockImplementation((url: unknown) => {
    const urlStr = String(url)
    if (urlStr.includes('/api/v1/roles')) return Promise.resolve({ data: resolveGet(testRoles, 1) })
    if (urlStr.includes('/hierarchy')) return Promise.resolve({ data: { result: testHierarchy } })
    return Promise.resolve({ data: resolveGet([], 0) })
  })
}

describe('CreateUserModal', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
    axiosMock.post.mockClear()
  })

  it('renders the same access fields as the edit drawer', async () => {
    mockReads()
    renderWithProviders(<CreateUserModal open onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(await screen.findByRole('heading', { name: 'Create Staff Member' })).toBeTruthy()
    expect(screen.getByLabelText(/^Name/i)).toBeTruthy()
    expect(screen.getByLabelText(/^Email/i)).toBeTruthy()
    expect(screen.getByLabelText(/^Supported Canonical Role/i)).toBeTruthy()
    expect(screen.getByText('Jurisdictional Boundary')).toBeTruthy()
    expect(screen.getByText('Province / Region')).toBeTruthy()
    expect(screen.getByText('Diocese')).toBeTruthy()
    expect(screen.getByText('Permitted Modules')).toBeTruthy()
    expect(screen.getAllByText('Access Denied (Airgapped)').length).toBeGreaterThan(0)
    expect(screen.getAllByPlaceholderText('Password')).toHaveLength(2)
  })

  it('posts the new staff member with its role and closes the drawer', async () => {
    mockReads()
    axiosMock.post.mockResolvedValueOnce({ data: { result: { id: 'new-1' } } })
    const onClose = vi.fn()
    const onSaved = vi.fn()

    renderWithProviders(<CreateUserModal open onClose={onClose} onSaved={onSaved} />)

    fireEvent.change(await screen.findByLabelText(/^Name/i), { target: { value: 'Admin' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), {
      target: { value: 'admin@x.com' },
    })

    fireEvent.mouseDown(screen.getByLabelText(/^Supported Canonical Role/i))
    fireEvent.click(await screen.findByTitle('Parish Lead'))

    // Permitted Modules now reflects the selected role's permissions.
    expect(await screen.findByText('View & Approve')).toBeTruthy()

    const passwords = screen.getAllByPlaceholderText('Password')
    fireEvent.change(passwords[0], { target: { value: 'Strong@123' } })
    fireEvent.change(passwords[1], { target: { value: 'Strong@123' } })

    fireEvent.click(screen.getByRole('button', { name: /create staff member/i }))

    await waitFor(() => expect(axiosMock.post).toHaveBeenCalled())
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/v1/users',
      expect.objectContaining({ email: 'admin@x.com', name: 'Admin', role_id: 'role-1' }),
    )
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })
})
