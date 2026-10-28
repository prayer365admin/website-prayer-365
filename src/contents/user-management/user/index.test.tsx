import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { axiosMock, renderWithProviders, resolveGet } from '@/test/frontend/render'
import ContentsUserManagementUser from './index'

const user = {
  id: 'u1',
  name: 'Alice',
  email: 'alice@x.com',
  role: { id: 'r1', name: 'Admin' },
}

describe('ContentsUserManagementUser', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
  })

  it('renders users and the header with Add Staff Member button', async () => {
    axiosMock.get.mockImplementation((url: unknown) => {
      if (String(url).includes('/api/v1/users'))
        return Promise.resolve({ data: resolveGet([user], 1) })
      return Promise.resolve({ data: resolveGet([], 0) })
    })
    renderWithProviders(<ContentsUserManagementUser />)
    expect(await screen.findByText('Alice')).toBeTruthy()
    expect(screen.getByText('Staff & Role Governance')).toBeTruthy()
    const roleChip = screen.getByText('Admin')
    expect(roleChip).toBeTruthy()
    expect(screen.getByText('Login with')).toBeTruthy()
    expect(screen.queryByText('Security')).toBeNull()
    expect(screen.getByRole('button', { name: /add staff member/i })).toBeTruthy()
  })

  it('renders the last login provider and real last activity', async () => {
    const active = {
      ...user,
      last_login_provider: 'google',
      last_active_at: new Date().toISOString(),
      updated_at: '2020-01-01T00:00:00.000Z',
    }
    axiosMock.get.mockImplementation((url: unknown) => {
      if (String(url).includes('/api/v1/users'))
        return Promise.resolve({ data: resolveGet([active], 1) })
      return Promise.resolve({ data: resolveGet([], 0) })
    })
    renderWithProviders(<ContentsUserManagementUser />)
    expect(await screen.findByText('Google')).toBeTruthy()
    // Last Active comes from last_active_at, not updated_at.
    expect(screen.getByText('1 minute ago')).toBeTruthy()
    expect(screen.queryByText(new Date('2020-01-01T00:00:00.000Z').toLocaleDateString())).toBeNull()
  })

  it('revalidates the list and shows a pending state while refetching', async () => {
    axiosMock.get.mockImplementation((url: unknown) => {
      if (String(url).includes('/api/v1/users'))
        return Promise.resolve({ data: resolveGet([user], 1) })
      return Promise.resolve({ data: resolveGet([], 0) })
    })
    renderWithProviders(<ContentsUserManagementUser />)
    await screen.findByText('Alice')

    // Hold the refetch open so the pending state is observable.
    const held = Promise.withResolvers<unknown>()
    axiosMock.get.mockImplementation(() => held.promise)

    const refresh = screen.getByRole('button', { name: /refresh/i })
    const callsBefore = axiosMock.get.mock.calls.length
    fireEvent.click(refresh)

    await waitFor(() => expect(refresh.getAttribute('aria-busy')).toBe('true'))
    expect((refresh as HTMLButtonElement).disabled).toBe(true)
    expect(axiosMock.get.mock.calls.length).toBeGreaterThan(callsBefore)

    held.resolve({ data: resolveGet([user], 1) })
    await waitFor(() => expect(refresh.getAttribute('aria-busy')).toBe('false'))
    expect((refresh as HTMLButtonElement).disabled).toBe(false)
    expect(await screen.findByText('Alice')).toBeTruthy()
  })

  it('opens Edit Scoped Role modal from row Edit', async () => {
    axiosMock.get.mockImplementation((url: unknown) => {
      const urlStr = String(url)
      if (urlStr.includes('/api/v1/users/u1')) return Promise.resolve({ data: { result: user } })
      if (urlStr.includes('/api/v1/users')) return Promise.resolve({ data: resolveGet([user], 1) })
      return Promise.resolve({ data: resolveGet([], 0) })
    })
    renderWithProviders(<ContentsUserManagementUser />)
    const editButton = await screen.findByRole('button', { name: /edit/i })
    fireEvent.click(editButton)
    expect(await screen.findByText('Edit Scoped Role')).toBeTruthy()
  })
})
