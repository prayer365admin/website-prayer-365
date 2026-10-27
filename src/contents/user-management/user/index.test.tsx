import { fireEvent, screen } from '@testing-library/react'
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
    expect(screen.getByRole('button', { name: /add staff member/i })).toBeTruthy()
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
