import { renderWithProviders } from '@/test/frontend/render'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsChurchAnnouncements from '.'

const m = vi.hoisted(() => ({
  canCreate: true,
  canUpdate: true,
  canPublish: true,
  canDelete: true,
  useAnnouncements: vi.fn(),
  onCreate: vi.fn(),
  onUpdate: vi.fn(),
  onPublish: vi.fn(),
  onUnpublish: vi.fn(),
  onDelete: vi.fn(),
}))

vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    createAny: () => ({ granted: m.canCreate }),
    createOwn: () => ({ granted: false }),
    updateAny: (subject: string) => ({
      granted: subject === 'prayer_announcement_publication' ? m.canPublish : m.canUpdate,
    }),
    updateOwn: () => ({ granted: false }),
    deleteAny: () => ({ granted: m.canDelete }),
    deleteOwn: () => ({ granted: false }),
  }),
}))
vi.mock('@/hooks/data/announcement', () => ({ useAnnouncements: m.useAnnouncements }))
vi.mock('@/hooks/data/church', () => ({
  useCurrentChurch: () => ({
    data: { id: 'c1', name: 'Grace', timezone: 'Europe/Tallinn' },
    loading: false,
  }),
}))

const draft = {
  id: 'a1',
  churchId: 'c1',
  title: 'Parish lunch',
  body: 'Join us after Sunday Mass.',
  publishedAt: null,
  version: 3,
  createdAt: '2026-10-01T00:00:00.000Z',
}
const published = {
  ...draft,
  id: 'a2',
  title: 'Published news',
  publishedAt: '2026-10-02T00:00:00.000Z',
  version: 4,
}

const state = (over = {}) => ({
  data: [draft, published],
  total: 2,
  loading: false,
  saving: false,
  publishingId: undefined,
  unpublishingId: undefined,
  error: null,
  onCreate: m.onCreate,
  onUpdate: m.onUpdate,
  onPublish: m.onPublish,
  onUnpublish: m.onUnpublish,
  onDelete: m.onDelete,
  ...over,
})

describe('ContentsChurchAnnouncements', () => {
  beforeEach(() => {
    m.canCreate = true
    m.canUpdate = true
    m.canPublish = true
    m.canDelete = true
    m.useAnnouncements.mockReset()
    m.useAnnouncements.mockReturnValue(state())
    m.onCreate.mockReset().mockResolvedValue(undefined)
    m.onUpdate.mockReset().mockResolvedValue(undefined)
    m.onPublish.mockReset().mockResolvedValue(undefined)
    m.onUnpublish.mockReset().mockResolvedValue(undefined)
    m.onDelete.mockReset().mockResolvedValue(undefined)
  })

  it('shows draft and published states and only offers publish for a draft', () => {
    renderWithProviders(<ContentsChurchAnnouncements churchId="c1" />)

    expect(screen.getByText('Parish lunch')).toBeTruthy()
    expect(screen.getByText('Draft')).toBeTruthy()
    expect(screen.getByText('Published')).toBeTruthy()
    const publish = screen.getByRole('button', { name: 'Publish Parish lunch' })
    const unpublish = screen.getByRole('button', { name: 'Unpublish Published news' })
    expect(publish.textContent).toBe('')
    expect(unpublish.textContent).toBe('')
    expect(screen.getAllByText('Published at').length).toBeGreaterThan(0)
  })

  it('hides publish and unpublish without the publication permission', () => {
    m.canPublish = false
    renderWithProviders(<ContentsChurchAnnouncements churchId="c1" />)

    expect(screen.queryByRole('button', { name: 'Publish Parish lunch' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Unpublish Published news' })).toBeNull()
    // Editing is a different permission and stays available.
    expect(screen.getAllByLabelText('edit').length).toBeGreaterThan(0)
  })

  it('confirms immediate publication with the current version', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchAnnouncements churchId="c1" />)

    await user.click(screen.getByRole('button', { name: 'Publish Parish lunch' }))
    expect(
      await screen.findByText('This makes the announcement immediately visible in the mobile app.'),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Publish now' }))

    await waitFor(() =>
      expect(m.onPublish).toHaveBeenCalledWith({ announcementId: 'a1', version: 3 }),
    )
  })

  it('confirms unpublish with the current version', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchAnnouncements churchId="c1" />)

    await user.click(screen.getByRole('button', { name: 'Unpublish Published news' }))
    expect(
      await screen.findByText(
        'This removes the announcement from the mobile app and returns it to Draft.',
      ),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Unpublish' }))

    await waitFor(() =>
      expect(m.onUnpublish).toHaveBeenCalledWith({ announcementId: 'a2', version: 4 }),
    )
  })

  it('hides create, edit, and publish actions from read-only users', () => {
    m.canCreate = false
    m.canUpdate = false
    m.canPublish = false
    renderWithProviders(<ContentsChurchAnnouncements churchId="c1" />)

    expect(screen.queryByRole('button', { name: /create announcement/i })).toBeNull()
    expect(screen.queryByLabelText('edit')).toBeNull()
    expect(screen.queryByRole('button', { name: /^publish /i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^unpublish /i })).toBeNull()
  })

  it('edits title and message with the row current version', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchAnnouncements churchId="c1" />)

    await user.click(screen.getAllByLabelText('edit')[0])
    const dialog = await screen.findByRole('dialog')
    const title = within(dialog).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Updated lunch')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(m.onUpdate).toHaveBeenCalledWith({
        announcementId: 'a1',
        payload: {
          title: 'Updated lunch',
          body: 'Join us after Sunday Mass.',
          version: 3,
        },
      }),
    )
  })

  it('creates a draft and validates both minimal fields', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchAnnouncements churchId="c1" />)
    await user.click(screen.getByRole('button', { name: /create announcement/i }))
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: 'Create draft' }))
    expect(await within(dialog).findByText('Enter an announcement title.')).toBeTruthy()
    expect(within(dialog).getByText('Enter an announcement message.')).toBeTruthy()
    expect(m.onCreate).not.toHaveBeenCalled()

    await user.type(within(dialog).getByLabelText('Title'), 'New notice')
    await user.type(within(dialog).getByLabelText('Message'), 'A short message.')
    await user.click(within(dialog).getByRole('button', { name: 'Create draft' }))

    await waitFor(() =>
      expect(m.onCreate).toHaveBeenCalledWith({
        title: 'New notice',
        body: 'A short message.',
      }),
    )
  })

  it('passes search and server-side sorting to the hook', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchAnnouncements churchId="c1" />)
    await user.type(screen.getByPlaceholderText('Search announcement title'), 'lunch{Enter}')

    await waitFor(() =>
      expect(m.useAnnouncements).toHaveBeenLastCalledWith(
        expect.objectContaining({ churchId: 'c1', search: 'lunch', page: 1 }),
      ),
    )

    await user.click(screen.getAllByText('Title')[0])
    await waitFor(() =>
      expect(m.useAnnouncements).toHaveBeenLastCalledWith(
        expect.objectContaining({
          churchId: 'c1',
          search: 'lunch',
          orderBy: 'title',
          orderDirection: 'asc',
        }),
      ),
    )
  })

  it('renders responsive status and publication-date filters', () => {
    renderWithProviders(<ContentsChurchAnnouncements churchId="c1" />)

    expect(screen.getByText('Filter status')).toBeTruthy()
    expect(screen.getByPlaceholderText('Published from')).toBeTruthy()
    expect(screen.getByPlaceholderText('Published until')).toBeTruthy()
  })

  it('keeps typed input open after a failed save so the edit can be retried', async () => {
    m.onUpdate.mockRejectedValueOnce(new Error('STALE_VERSION'))
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchAnnouncements churchId="c1" />)

    await user.click(screen.getAllByLabelText('edit')[0])
    const dialog = await screen.findByRole('dialog')
    const title = within(dialog).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Retry this notice')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(m.onUpdate).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect((within(dialog).getByLabelText('Title') as HTMLInputElement).value).toBe(
      'Retry this notice',
    )

    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(m.onUpdate).toHaveBeenCalledTimes(2))
  })

  it('keeps the opened row snapshot and version if the list refreshes', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchAnnouncements churchId="c1" />)

    await user.click(screen.getAllByLabelText('edit')[0])
    const dialog = await screen.findByRole('dialog')
    m.useAnnouncements.mockReturnValue(
      state({
        data: [{ ...draft, title: 'Refreshed title', version: 9 }, published],
      }),
    )
    await user.type(screen.getByPlaceholderText('Search announcement title'), 'r')

    expect((within(dialog).getByLabelText('Title') as HTMLInputElement).value).toBe('Parish lunch')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(m.onUpdate).toHaveBeenCalledWith({
        announcementId: 'a1',
        payload: {
          title: 'Parish lunch',
          body: 'Join us after Sunday Mass.',
          version: 3,
        },
      }),
    )
  })

  it('shows empty, loading, and error states distinctly', () => {
    m.useAnnouncements.mockReturnValue(state({ data: [], total: 0 }))
    const first = renderWithProviders(<ContentsChurchAnnouncements churchId="c1" />)
    expect(screen.getByText('No announcements found for this church.')).toBeTruthy()
    first.unmount()

    m.useAnnouncements.mockReturnValue(state({ data: undefined, loading: true }))
    const second = renderWithProviders(<ContentsChurchAnnouncements churchId="c1" />)
    expect(second.container.querySelector('.ant-spin')).toBeTruthy()
    second.unmount()

    m.useAnnouncements.mockReturnValue(state({ data: undefined, error: new Error('x') }))
    renderWithProviders(<ContentsChurchAnnouncements churchId="c1" />)
    expect(screen.getByText('Announcements could not be loaded')).toBeTruthy()
  })

  it('confirms deletion and soft-deletes with the row current version', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchAnnouncements churchId="c1" />)

    await user.click(screen.getAllByLabelText('delete')[1])
    await user.click(await screen.findByRole('button', { name: 'OK' }))

    await waitFor(() =>
      expect(m.onDelete).toHaveBeenCalledWith({ announcementId: 'a2', version: 4 }),
    )
  })

  it('hides delete without delete permission', () => {
    m.canDelete = false
    renderWithProviders(<ContentsChurchAnnouncements churchId="c1" />)

    expect(screen.queryByLabelText('delete')).toBeNull()
  })
})
