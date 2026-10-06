import { renderWithProviders } from '@/test/frontend/render'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsChurchEvents from '.'

const m = vi.hoisted(() => ({
  canCreate: true,
  canUpdate: true,
  useEvents: vi.fn(),
  onCreate: vi.fn(),
  onUpdate: vi.fn(),
}))

vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    createAny: () => ({ granted: m.canCreate }),
    createOwn: () => ({ granted: false }),
    updateAny: () => ({ granted: m.canUpdate }),
    updateOwn: () => ({ granted: false }),
    deleteAny: () => ({ granted: false }),
    deleteOwn: () => ({ granted: false }),
  }),
}))
vi.mock('@/hooks/data/church', () => ({
  useChurch: () => ({ data: { id: 'c1', timezone: 'Europe/Tallinn' }, loading: false }),
  useChurchProfile: () => ({ data: { languageCodes: ['et'] }, loading: false }),
}))
vi.mock('@/hooks/data/event', () => ({ useEvents: m.useEvents }))

const event = {
  id: 'e1',
  churchId: 'c1',
  category: 'SERVICE',
  title: 'Sunday service',
  description: '',
  startsAt: '2026-02-15T08:00:00.000Z',
  location: 'Main hall',
  registrationUrl: 'https://example.org/r',
  languageCode: 'et',
  version: 4,
}

const state = (over = {}) => ({
  data: [event],
  total: 1,
  loading: false,
  error: null,
  onCreate: m.onCreate,
  onUpdate: m.onUpdate,
  ...over,
})

describe('ContentsChurchEvents', () => {
  beforeEach(() => {
    m.canCreate = true
    m.canUpdate = true
    m.useEvents.mockReset()
    m.useEvents.mockReturnValue(state())
    m.onUpdate.mockReset().mockResolvedValue(undefined)
  })

  it('renders church-local start, timezone, and safe external link', () => {
    renderWithProviders(<ContentsChurchEvents churchId="c1" />)
    expect(screen.getByText('Sunday service')).toBeTruthy()
    expect(screen.getByText('15 Feb 2026, 10:00')).toBeTruthy()
    expect(screen.getByText('Europe/Tallinn')).toBeTruthy()
    const link = screen.getByRole('link', { name: /open link/i })
    expect(link.getAttribute('href')).toBe('https://example.org/r')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('shows empty and error states', () => {
    m.useEvents.mockReturnValue(state({ data: [], total: 0 }))
    const { unmount } = renderWithProviders(<ContentsChurchEvents churchId="c1" />)
    expect(screen.getByText('No events found for this church.')).toBeTruthy()
    unmount()
    m.useEvents.mockReturnValue(state({ data: undefined, error: new Error('x') }))
    renderWithProviders(<ContentsChurchEvents churchId="c1" />)
    expect(screen.getByText('Events could not be loaded')).toBeTruthy()
  })

  it('hides create and edit for read-only users', () => {
    m.canCreate = false
    m.canUpdate = false
    renderWithProviders(<ContentsChurchEvents churchId="c1" />)
    expect(screen.queryByRole('button', { name: /create event/i })).toBeNull()
    expect(screen.queryByLabelText('edit')).toBeNull()
  })

  it('passes search and category filters to the hook', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchEvents churchId="c1" />)
    await user.type(screen.getByPlaceholderText('Search title or location'), 'sun{Enter}')
    await waitFor(() =>
      expect(m.useEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({ churchId: 'c1', search: 'sun', page: 1 }),
      ),
    )
  })

  it('edits an event with its current version', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchEvents churchId="c1" />)
    await user.click(screen.getByLabelText('edit'))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(m.onUpdate).toHaveBeenCalled())
    expect(m.onUpdate.mock.calls[0][0]).toMatchObject({
      eventId: 'e1',
      payload: { version: 4, startsAt: '2026-02-15T10:00:00+02:00' },
    })
    // modal stays mounted so antd can run its close animation (jsdom never finishes it)
    await waitFor(() =>
      expect(screen.getByRole('dialog', { hidden: true }).closest('.ant-modal')?.className).toMatch(
        /leave/,
      ),
    )
  })

  it('keeps editor open when save fails', async () => {
    m.onUpdate.mockRejectedValue(new Error('stale'))
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchEvents churchId="c1" />)
    await user.click(screen.getByLabelText('edit'))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(m.onUpdate).toHaveBeenCalled())
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})

describe('ContentsChurchEvents edit prefill', () => {
  it('prefills the clicked row, including after reopening another row', async () => {
    const second = { ...event, id: 'e2', title: 'Youth night', location: 'Annex' }
    m.canCreate = true
    m.canUpdate = true
    m.useEvents.mockReturnValue(state({ data: [event, second], total: 2 }))
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchEvents churchId="c1" />)
    const edits = screen.getAllByLabelText('edit')
    await user.click(edits[0])
    expect(((await screen.findByLabelText('Title')) as HTMLInputElement).value).toBe(
      'Sunday service',
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() =>
      expect(screen.getByRole('dialog', { hidden: true }).closest('.ant-modal')?.className).toMatch(
        /leave/,
      ),
    )
    await user.click(edits[1])
    await waitFor(() =>
      expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Youth night'),
    )
  })
})

describe('ContentsChurchEvents remaining acceptance flows', () => {
  beforeEach(() => {
    m.canCreate = true
    m.canUpdate = true
    m.useEvents.mockReset()
    m.useEvents.mockReturnValue(state())
    m.onCreate.mockReset().mockResolvedValue(undefined)
    m.onUpdate.mockReset().mockResolvedValue(undefined)
  })

  it('shows a loading state distinct from empty', () => {
    m.useEvents.mockReturnValue(state({ data: undefined, loading: true }))
    const { container } = renderWithProviders(<ContentsChurchEvents churchId="c1" />)
    expect(container.querySelector('.ant-spin')).toBeTruthy()
  })

  it('passes the category filter to the hook and resets to page 1', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchEvents churchId="c1" />)
    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(await screen.findByTitle('Bible study'))
    await waitFor(() =>
      expect(m.useEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: 'BIBLE_STUDY', page: 1 }),
      ),
    )
  })

  it('creates an event with an explicit-offset start and closes the editor', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchEvents churchId="c1" />)
    await user.click(screen.getByRole('button', { name: /create event/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Title'), 'Bible night')
    await user.type(within(dialog).getByLabelText('Location'), 'Room 2')
    await user.type(within(dialog).getByLabelText('Date and time'), '2026-02-15 18:00{Enter}')
    await user.click(within(dialog).getByRole('button', { name: 'Create event' }))
    await waitFor(() => expect(m.onCreate).toHaveBeenCalled())
    expect(m.onCreate.mock.calls[0][0]).toMatchObject({
      title: 'Bible night',
      startsAt: '2026-02-15T18:00:00+02:00',
    })
    await waitFor(() =>
      expect(screen.getByRole('dialog', { hidden: true }).closest('.ant-modal')?.className).toMatch(
        /leave/,
      ),
    )
  })

  it('keeps typed input when a save is rejected (stale or validation) so it can be retried', async () => {
    m.onUpdate.mockRejectedValueOnce(new Error('STALE_VERSION'))
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchEvents churchId="c1" />)
    await user.click(screen.getByLabelText('edit'))
    const dialog = await screen.findByRole('dialog')
    const title = within(dialog).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Renamed service')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(m.onUpdate).toHaveBeenCalledTimes(1))
    expect((within(dialog).getByLabelText('Title') as HTMLInputElement).value).toBe(
      'Renamed service',
    )

    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(m.onUpdate).toHaveBeenCalledTimes(2))
    expect(m.onUpdate.mock.calls[1][0].payload).toMatchObject({
      title: 'Renamed service',
      version: 4,
    })
  })

  it('does not duplicate-create when the edited row leaves the list while the editor is open', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchEvents churchId="c1" />)
    await user.click(screen.getByLabelText('edit'))
    const dialog = await screen.findByRole('dialog')

    // A refetch (e.g. filter change) removes the row from the current page while the modal stays open.
    m.useEvents.mockReturnValue(state({ data: [], total: 0 }))
    await user.type(screen.getByPlaceholderText('Search title or location'), 'x{Enter}')
    await waitFor(() => within(dialog).getByRole('button', { name: 'Create event' }))

    // Edit intent is still set but the event has no version now: must NOT create a new event.
    await user.click(within(dialog).getByRole('button', { name: 'Create event' }))
    expect(m.onCreate).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('button', { name: 'Create event' })).toBeTruthy()
  })

  it('shows client validation errors without calling the API', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchEvents churchId="c1" />)
    await user.click(screen.getByRole('button', { name: /create event/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Create event' }))
    await screen.findByText('Enter an event title.')
    expect(m.onCreate).not.toHaveBeenCalled()
  })
})
