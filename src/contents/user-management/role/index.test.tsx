import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { axiosMock, renderWithProviders, resolveGet } from '@/test/frontend/render'
import ContentsUserManagementRole from './index'

describe('ContentsUserManagementRole', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
  })

  it('renders roles in the table', async () => {
    axiosMock.get.mockResolvedValue({
      data: resolveGet([{ id: 'r1', name: 'Administrator', type: 'SYSTEM', permission: [] }], 1),
    })
    renderWithProviders(<ContentsUserManagementRole />)
    expect(await screen.findByText('Administrator')).toBeTruthy()
    expect(screen.getByText('SYSTEM')).toBeTruthy()
  })
})
