import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { axiosMock, renderWithProviders } from '@/test/frontend/render'
import ContentsUserManagementUserEdit from './index'

const user = {
  id: 'r1',
  name: 'Alice',
  email: 'alice@x.com',
  profile_picture: null,
  role: { id: 'r1', name: 'Admin' },
}

describe('ContentsUserManagementUserEdit', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
    axiosMock.put.mockClear()
  })

  it('loads the user and updates it', async () => {
    axiosMock.get.mockImplementation((url: unknown) => {
      if (String(url).includes('/users/r1')) return Promise.resolve({ data: { result: user } })
      return Promise.resolve({ data: { result: [] } }) // roles for SelectRole
    })
    axiosMock.put.mockResolvedValue({ data: {} })
    const userEventCall = userEvent.setup()
    renderWithProviders(<ContentsUserManagementUserEdit />)

    const input = await screen.findByPlaceholderText('Ex. Administrator')
    await userEventCall.clear(input)
    await userEventCall.type(input, 'Bobby')
    await userEventCall.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(axiosMock.put).toHaveBeenCalled())
    expect(axiosMock.put).toHaveBeenCalledWith(
      '/api/v1/users/r1',
      expect.objectContaining({ name: 'Bobby' }),
    )
  })
})
