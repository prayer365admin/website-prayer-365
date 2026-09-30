import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { axiosMock, renderWithProviders } from '@/test/frontend/render'
import ContentsUserManagementRoleEdit from './index'

const role = { id: 'r1', name: 'Administrator', type: 'SYSTEM', permission: [] }

describe('ContentsUserManagementRoleEdit', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
    axiosMock.put.mockClear()
  })

  it('loads the role and updates it', async () => {
    axiosMock.get.mockImplementation((url: unknown) => {
      if (String(url).includes('/roles/r1')) return Promise.resolve({ data: { result: role } })
      return Promise.resolve({ data: { result: [] } }) // permissions
    })
    axiosMock.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    renderWithProviders(<ContentsUserManagementRoleEdit />)

    const input = await screen.findByPlaceholderText('Administrator')
    await user.clear(input)
    await user.type(input, 'Super')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(axiosMock.put).toHaveBeenCalled())
    expect(axiosMock.put).toHaveBeenCalledWith(
      '/api/v1/roles/r1',
      expect.objectContaining({ name: 'Super' }),
    )
  })
})
