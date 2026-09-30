import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { axiosMock, renderWithProviders } from '@/test/frontend/render'
import ContentsUserManagementUserCreate from './index'

describe('ContentsUserManagementUserCreate', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
    axiosMock.post.mockClear()
  })

  it('creates a user and posts to the api', async () => {
    axiosMock.get.mockResolvedValue({ data: { result: [] } }) // roles for SelectRole
    axiosMock.post.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    renderWithProviders(<ContentsUserManagementUserCreate />)

    await user.type(screen.getByPlaceholderText('Ex. admin@catatia.com'), 'admin@x.com')
    await user.type(screen.getByPlaceholderText('Ex. Administrator'), 'Admin')
    const passwords = screen.getAllByPlaceholderText('Password')
    await user.type(passwords[0], 'Strong@123')
    await user.type(passwords[1], 'Strong@123')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(axiosMock.post).toHaveBeenCalled())
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/v1/users',
      expect.objectContaining({ email: 'admin@x.com', name: 'Admin' }),
    )
  })
})
