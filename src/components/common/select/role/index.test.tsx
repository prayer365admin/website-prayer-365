import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axiosMock, renderWithProviders } from '@/test/frontend/render'
import SelectRole from './index'
import RoleFilter from './filter'

describe('SelectRole', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
    axiosMock.get.mockResolvedValue({ data: { result: [{ id: 'r1', name: 'Administrator' }] } })
  })

  it('loads roles into the select options', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SelectRole name="role_id" label="Role" />)
    await waitFor(() =>
      expect(axiosMock.get).toHaveBeenCalledWith(expect.stringContaining('/api/v1/roles')),
    )
    await user.click(await screen.findByRole('combobox'))
    expect(await screen.findByText('Administrator')).toBeTruthy()
  })
})

describe('RoleFilter', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
    axiosMock.get.mockResolvedValue({ data: { result: [{ id: 'r1', name: 'Administrator' }] } })
  })

  it('calls setValue when a role is picked', async () => {
    const user = userEvent.setup()
    const setValue = vi.fn()
    renderWithProviders(<RoleFilter setValue={setValue} />)
    await waitFor(() => expect(axiosMock.get).toHaveBeenCalled())
    await user.click(await screen.findByRole('combobox'))
    await user.click(await screen.findByText('Administrator'))
    expect(setValue).toHaveBeenCalledWith('r1')
  })
})
