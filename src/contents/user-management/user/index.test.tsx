import { screen } from '@testing-library/react'
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

  it('renders users and the create button', async () => {
    axiosMock.get.mockImplementation((url: unknown) => {
      if (String(url).includes('/api/v1/users'))
        return Promise.resolve({ data: resolveGet([user], 1) })
      return Promise.resolve({ data: resolveGet([], 0) }) // roles for RoleFilter
    })
    renderWithProviders(<ContentsUserManagementUser />)
    expect(await screen.findByText('Alice')).toBeTruthy()
    expect(screen.getByText('Admin')).toBeTruthy()
    expect(screen.getByRole('button', { name: /create user/i })).toBeTruthy()
  })
})
