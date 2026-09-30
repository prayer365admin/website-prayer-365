import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { axiosMock, renderWithProviders } from '@/test/frontend/render'
import ContentsUserManagementRoleCreate from './index'

describe('ContentsUserManagementRoleCreate', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
    axiosMock.post.mockClear()
  })

  it('creates a role and posts to the api', async () => {
    axiosMock.get.mockResolvedValue({ data: { result: [] } }) // permissions
    axiosMock.post.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    renderWithProviders(<ContentsUserManagementRoleCreate />)

    await user.type(screen.getByPlaceholderText('Administrator'), 'Manager')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(axiosMock.post).toHaveBeenCalled())
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/v1/roles',
      expect.objectContaining({ name: 'Manager' }),
    )
  })
})
