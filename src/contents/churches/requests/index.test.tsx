import {
  pushMock,
  renderWithProviders,
  replaceMock,
  searchParamsMock,
} from '@/test/frontend/render'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsChurchRequests from '.'

const m = vi.hoisted(() => ({ useRequests: vi.fn() }))
vi.mock('@/hooks/data/request', () => ({ useRequests: m.useRequests }))
vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    updateAny: () => ({ granted: true }),
    updateOwn: () => ({ granted: false }),
    deleteAny: () => ({ granted: true }),
    deleteOwn: () => ({ granted: false }),
  }),
}))

const rows = [
  {
    id: 'q1',
    kind: 'prayer',
    subject: 'Prayer for family',
    classification: 'private',
    contactMethod: 'email',
    createdAt: '2026-10-01T09:00:00.000Z',
  },
  {
    id: 'q2',
    kind: 'prayer',
    subject: 'Healing',
    classification: 'standard',
    contactMethod: 'phone',
    createdAt: '2026-10-02T09:00:00.000Z',
  },
]

const state = (over = {}) => ({
  data: rows,
  total: 2,
  loading: false,
  fetching: false,
  error: null,
  notFound: false,
  ...over,
})

describe('ContentsChurchRequests (S10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchParamsMock.get.mockReturnValue(null)
    m.useRequests.mockReturnValue(state())
  })

  it('defaults to the prayer tab and requests only the prayer kind', () => {
    renderWithProviders(<ContentsChurchRequests churchId="c1" />)
    expect(m.useRequests).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c1', kinds: ['prayer'], page: 1 }),
    )
    expect(screen.getByRole('tab', { name: 'Prayer requests', selected: true })).toBeTruthy()
  })

  it('reads the pastoral/meeting tab from the URL and requests both kinds', () => {
    searchParamsMock.get.mockImplementation((key: string) => (key === 'tab' ? 'pastoral' : null))
    m.useRequests.mockReturnValue(
      state({
        data: [{ ...rows[0], id: 'q3', kind: 'meeting', subject: null, classification: null }],
        total: 1,
      }),
    )
    renderWithProviders(<ContentsChurchRequests churchId="c1" />)
    expect(m.useRequests).toHaveBeenCalledWith(
      expect.objectContaining({ kinds: ['pastoral', 'meeting'] }),
    )
    // No subject: the kind label stands in; pastoral/meeting are always Restricted.
    const row = screen.getByText('Meeting request').closest('tr')!
    expect(within(row).getByText('Restricted')).toBeTruthy()
  })

  it('switching tabs writes the tab to the URL', async () => {
    renderWithProviders(<ContentsChurchRequests churchId="c1" />)
    await userEvent.click(screen.getByRole('tab', { name: 'Pastoral / Meeting requests' }))
    expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('?tab=pastoral'))
  })

  it('renders classification labels and opens the detail from the action icon', async () => {
    renderWithProviders(<ContentsChurchRequests churchId="c1" />)
    const privateRow = screen.getByText('Prayer for family').closest('tr')!
    expect(within(privateRow).getByText('Private')).toBeTruthy()
    // Shared edit-style action icon, no delete (requests are read-only).
    expect(within(privateRow).queryByRole('img', { name: 'delete' })).toBeNull()
    await userEvent.click(within(privateRow).getByRole('img', { name: 'edit' }))
    expect(pushMock).toHaveBeenCalledWith('/dashboard/churches/c1/requests/q1')
    const standardRow = screen.getByText('Healing').closest('tr')!
    expect(within(standardRow).getByText('Standard')).toBeTruthy()
  })

  it('searches by subject and resets to page 1', async () => {
    renderWithProviders(<ContentsChurchRequests churchId="c1" />)
    await userEvent.type(screen.getByPlaceholderText('Search request subject'), 'family{enter}')
    expect(m.useRequests).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'family', page: 1 }),
    )
  })

  it('filters prayer requests by classification', async () => {
    renderWithProviders(<ContentsChurchRequests churchId="c1" />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Filter classification' }))
    await userEvent.click(await screen.findByTitle('Private'))
    expect(m.useRequests).toHaveBeenLastCalledWith(
      expect.objectContaining({ kinds: ['prayer'], classification: 'private', page: 1 }),
    )
  })

  it('filters the pastoral/meeting tab by type instead of classification', async () => {
    searchParamsMock.get.mockImplementation((key: string) => (key === 'tab' ? 'pastoral' : null))
    renderWithProviders(<ContentsChurchRequests churchId="c1" />)
    expect(screen.queryByRole('combobox', { name: 'Filter classification' })).toBeNull()
    await userEvent.click(screen.getByRole('combobox', { name: 'Filter type' }))
    await userEvent.click(await screen.findByTitle('Meeting request'))
    expect(m.useRequests).toHaveBeenLastCalledWith(
      expect.objectContaining({ kinds: ['meeting'], classification: undefined }),
    )
  })

  it('shows a received date range filter', () => {
    renderWithProviders(<ContentsChurchRequests churchId="c1" />)
    expect(screen.getByPlaceholderText('Received from')).toBeTruthy()
    expect(screen.getByPlaceholderText('Received until')).toBeTruthy()
  })

  it('has no status, assignment or bulk-action controls (D3)', () => {
    renderWithProviders(<ContentsChurchRequests churchId="c1" />)
    for (const name of [/status/i, /assign/i, /export/i]) {
      expect(screen.queryByRole('columnheader', { name })).toBeNull()
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('shows a neutral no-access state without counts on 404', () => {
    m.useRequests.mockReturnValue(state({ data: undefined, total: undefined, notFound: true }))
    renderWithProviders(<ContentsChurchRequests churchId="c1" />)
    expect(screen.getByText('You do not have access to requests for this church')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('shows the permission note', () => {
    renderWithProviders(<ContentsChurchRequests churchId="c1" />)
    expect(screen.getByText(/Only requests allowed by your church/)).toBeTruthy()
  })
})
