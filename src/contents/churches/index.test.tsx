import {
  renderWithProviders,
  resolveGet,
  axiosMock,
  pushMock,
  replaceMock,
  searchParamsMock,
  sessionMock,
} from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ContentsChurches from '.'

const churchA = {
  id: 'c1',
  name: 'Grace',
  status: 'APPROVED',
  timezone: 'Europe/Tallinn',
  city: 'Tallinn',
  version: 3,
}
const churchB = {
  id: 'c2',
  name: 'Hope',
  status: 'PENDING',
  timezone: 'Europe/Helsinki',
  city: 'Helsinki',
  version: 1,
}

describe('ContentsChurches', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
    pushMock.mockClear()
    replaceMock.mockClear()
    sessionMock.mockClear()
    searchParamsMock.get.mockReset()
    searchParamsMock.get.mockReturnValue(null)
    searchParamsMock.toString.mockReset()
    searchParamsMock.toString.mockReturnValue('')
    sessionMock.mockReturnValue({
      data: { user: { role: { id: 'r1', name: 'Church administrator' } } },
      status: 'authenticated',
    })
  })

  afterEach(() => {
    sessionMock.mockReset()
  })

  it('renders assigned churches', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet([churchA, churchB], 2) })
    renderWithProviders(<ContentsChurches />)

    expect(screen.getByText('Choose Church')).toBeTruthy()
    expect(screen.getByText('Select a church assigned to your account.')).toBeTruthy()

    await screen.findByText('Grace')
    await screen.findByText('Hope')

    expect(screen.getByText('Tallinn')).toBeTruthy()
    expect(screen.getByText('Helsinki')).toBeTruthy()

    const accessCells = screen.getAllByText('Church administrator')
    expect(accessCells.length).toBeGreaterThanOrEqual(2)

    const buttons = screen.getAllByRole('button', { name: 'Open' })
    expect(buttons).toHaveLength(2)

    expect(axiosMock.get).toHaveBeenCalledTimes(1)
    expect(axiosMock.get).toHaveBeenCalledWith(
      '/api/v1/admin/churches?&limit=100&page=1&order_by=name&order_direction=asc',
    )
  })

  it('open navigates to church overview', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet([churchA, churchB], 2) })
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurches />)

    const buttons = await screen.findAllByRole('button', { name: 'Open' })
    await user.click(buttons[0])

    expect(pushMock).toHaveBeenCalledWith('/dashboard/churches/c1')
  })

  it('skips selector when single', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet([churchA], 1) })
    renderWithProviders(<ContentsChurches />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/dashboard/churches/c1')
    })

    expect(screen.queryByText('Grace')).toBeFalsy()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('preserves the access-denied notice when auto-selecting one church', async () => {
    searchParamsMock.get.mockImplementation((key: string) =>
      key === 'notice' ? 'church_access_denied' : null,
    )
    searchParamsMock.toString.mockReturnValue('notice=church_access_denied')
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet([churchA], 1) })

    renderWithProviders(<ContentsChurches />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/dashboard/churches/c1?notice=church_access_denied')
    })
  })

  it('shows empty state', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet([], 0) })
    renderWithProviders(<ContentsChurches />)

    await screen.findByText(/no assigned churches/i)

    expect(replaceMock).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })
})
