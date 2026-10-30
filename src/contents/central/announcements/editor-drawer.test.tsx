import { renderWithProviders } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  canPublish: true,
  announcement: { data: undefined as unknown, loading: false, error: null as unknown },
  onCreate: vi.fn(),
  onUpdate: vi.fn(),
  onPublish: vi.fn(),
  onUnpublish: vi.fn(),
}))

vi.mock('@/hooks/data/announcement', () => ({
  useCentralAnnouncement: () => m.announcement,
  useAnnouncementActions: () => ({
    publishingId: undefined,
    unpublishingId: undefined,
    onCreate: m.onCreate,
    onUpdate: m.onUpdate,
    onPublish: m.onPublish,
    onUnpublish: m.onUnpublish,
  }),
}))
vi.mock('@/hooks/data/central', () => ({
  useCentralChurchList: () => ({
    data: [
      { id: 'c1', name: 'Grace' },
      { id: 'c2', name: 'Hope' },
    ],
    loading: false,
  }),
}))
vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    updateAny: (subject: string) => ({
      granted: subject === 'prayer_announcement_publication' ? m.canPublish : true,
    }),
    updateOwn: () => ({ granted: false }),
  }),
}))

import ContentsCentralAnnouncementEditor from './editor-drawer'

const existing = {
  id: 'a1',
  churchId: 'c1',
  title: 'Parish lunch',
  body: 'Join us.',
  publishedAt: null as string | null,
  version: 3,
  createdAt: '2026-09-30T09:00:00.000Z',
  church: { name: 'Grace', timezone: 'UTC' },
}

describe('ContentsCentralAnnouncementEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.canPublish = true
    m.announcement = { data: undefined, loading: false, error: null }
  })

  it('renders a 640px right drawer with a titled header', () => {
    renderWithProviders(<ContentsCentralAnnouncementEditor mode="create" onClose={vi.fn()} />)

    expect(screen.getByRole('heading', { level: 2, name: 'New announcement' })).toBeTruthy()
    const wrapper = document.querySelector<HTMLElement>('.ant-drawer-content-wrapper')
    expect(wrapper?.style.width).toBe('640px')
  })

  it('creates a draft in the selected church', async () => {
    m.onCreate.mockResolvedValue({ id: 'new-1', churchId: 'c2', version: 1 })
    const onClose = vi.fn()
    renderWithProviders(<ContentsCentralAnnouncementEditor mode="create" onClose={onClose} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByTitle('Hope'))
    await user.type(screen.getByLabelText('Title'), ' Choir ')
    await user.type(screen.getByLabelText('Message'), 'Practice moved.')
    await user.click(screen.getByRole('button', { name: /Save Changes/ }))

    await waitFor(() =>
      expect(m.onCreate).toHaveBeenCalledWith({
        churchId: 'c2',
        title: 'Choir',
        body: 'Practice moved.',
      }),
    )
    expect(m.onPublish).not.toHaveBeenCalled()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('requires a church on create', async () => {
    const onClose = vi.fn()
    renderWithProviders(<ContentsCentralAnnouncementEditor mode="create" onClose={onClose} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Title'), 'Choir')
    await user.type(screen.getByLabelText('Message'), 'Practice moved.')
    await user.click(screen.getByRole('button', { name: /Save Changes/ }))

    expect(await screen.findByText('Select a church.')).toBeTruthy()
    expect(m.onCreate).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('publishes a new draft when the switch is on, chaining the created version', async () => {
    m.onCreate.mockResolvedValue({ id: 'new-1', churchId: 'c2', version: 1 })
    m.onPublish.mockResolvedValue({})
    const onClose = vi.fn()
    renderWithProviders(<ContentsCentralAnnouncementEditor mode="create" onClose={onClose} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByTitle('Hope'))
    await user.type(screen.getByLabelText('Title'), 'Choir')
    await user.type(screen.getByLabelText('Message'), 'Practice moved.')
    await user.click(screen.getByRole('switch', { name: 'Publish?' }))
    await user.click(screen.getByRole('button', { name: /Save Changes/ }))

    await waitFor(() =>
      expect(m.onPublish).toHaveBeenCalledWith({
        churchId: 'c2',
        announcementId: 'new-1',
        version: 1,
      }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('keeps the drawer open when publishing after create fails', async () => {
    m.onCreate.mockResolvedValue({ id: 'new-1', churchId: 'c2', version: 1 })
    m.onPublish.mockRejectedValue(new Error('conflict'))
    const onClose = vi.fn()
    renderWithProviders(<ContentsCentralAnnouncementEditor mode="create" onClose={onClose} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByTitle('Hope'))
    await user.type(screen.getByLabelText('Title'), 'Choir')
    await user.type(screen.getByLabelText('Message'), 'Practice moved.')
    await user.click(screen.getByRole('switch', { name: 'Publish?' }))
    await user.click(screen.getByRole('button', { name: /Save Changes/ }))

    await waitFor(() => expect(m.onPublish).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 2, name: 'New announcement' })).toBeTruthy()
  })

  it('prefills an announcement and keeps the church fixed', () => {
    m.announcement = { data: existing, loading: false, error: null }
    renderWithProviders(
      <ContentsCentralAnnouncementEditor mode="edit" announcementId="a1" onClose={vi.fn()} />,
    )

    expect(screen.getByRole('heading', { level: 2, name: 'Parish lunch' })).toBeTruthy()
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Parish lunch')
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Join us.')
    expect(screen.getByText('Grace')).toBeTruthy()
    expect(screen.getByText('The church cannot be changed after creation.')).toBeTruthy()
  })

  it('closes without a request when nothing changed', async () => {
    m.announcement = { data: existing, loading: false, error: null }
    const onClose = vi.fn()
    renderWithProviders(
      <ContentsCentralAnnouncementEditor mode="edit" announcementId="a1" onClose={onClose} />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Save Changes/ }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(m.onUpdate).not.toHaveBeenCalled()
    expect(m.onPublish).not.toHaveBeenCalled()
    expect(m.onUnpublish).not.toHaveBeenCalled()
  })

  it('saves changed content with the current version', async () => {
    m.announcement = { data: existing, loading: false, error: null }
    m.onUpdate.mockResolvedValue({ version: 4 })
    const onClose = vi.fn()
    renderWithProviders(
      <ContentsCentralAnnouncementEditor mode="edit" announcementId="a1" onClose={onClose} />,
    )
    const user = userEvent.setup()

    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'Parish dinner')
    await user.click(screen.getByRole('button', { name: /Save Changes/ }))

    await waitFor(() =>
      expect(m.onUpdate).toHaveBeenCalledWith({
        churchId: 'c1',
        announcementId: 'a1',
        payload: { title: 'Parish dinner', body: 'Join us.', version: 3 },
      }),
    )
    expect(m.onPublish).not.toHaveBeenCalled()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('publishes with the version returned by the update', async () => {
    m.announcement = { data: existing, loading: false, error: null }
    m.onUpdate.mockResolvedValue({ version: 4 })
    m.onPublish.mockResolvedValue({})
    renderWithProviders(
      <ContentsCentralAnnouncementEditor mode="edit" announcementId="a1" onClose={vi.fn()} />,
    )
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Message'), ' Bring a dish.')
    await user.click(screen.getByRole('switch', { name: 'Publish?' }))
    await user.click(screen.getByRole('button', { name: /Save Changes/ }))

    await waitFor(() =>
      expect(m.onPublish).toHaveBeenCalledWith({
        churchId: 'c1',
        announcementId: 'a1',
        version: 4,
      }),
    )
  })

  it('unpublishes a published announcement when the switch is turned off', async () => {
    m.announcement = {
      data: { ...existing, publishedAt: '2026-10-01T09:00:00.000Z', version: 4 },
      loading: false,
      error: null,
    }
    m.onUnpublish.mockResolvedValue({})
    renderWithProviders(
      <ContentsCentralAnnouncementEditor mode="edit" announcementId="a1" onClose={vi.fn()} />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole('switch', { name: 'Publish?' }))
    await user.click(screen.getByRole('button', { name: /Save Changes/ }))

    await waitFor(() =>
      expect(m.onUnpublish).toHaveBeenCalledWith({
        churchId: 'c1',
        announcementId: 'a1',
        version: 4,
      }),
    )
    expect(m.onUpdate).not.toHaveBeenCalled()
    expect(m.onPublish).not.toHaveBeenCalled()
  })

  it('disables the publish switch without the publication permission', () => {
    m.canPublish = false
    m.announcement = { data: existing, loading: false, error: null }
    renderWithProviders(
      <ContentsCentralAnnouncementEditor mode="edit" announcementId="a1" onClose={vi.fn()} />,
    )

    const toggle = screen.getByRole('switch', { name: 'Publish?' }) as HTMLButtonElement
    expect(toggle.disabled).toBe(true)
  })

  it('renders view mode read-only with a single close action', async () => {
    m.announcement = { data: existing, loading: false, error: null }
    const onClose = vi.fn()
    renderWithProviders(
      <ContentsCentralAnnouncementEditor mode="view" announcementId="a1" onClose={onClose} />,
    )
    const user = userEvent.setup()

    expect((screen.getByLabelText('Title') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: /Save Changes/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
    expect(m.onUpdate).not.toHaveBeenCalled()
  })

  it('shows a load error for a missing or out-of-scope announcement', () => {
    m.announcement = { data: undefined, loading: false, error: new Error('404') }
    renderWithProviders(
      <ContentsCentralAnnouncementEditor mode="edit" announcementId="missing" onClose={vi.fn()} />,
    )

    expect(screen.getByText('Announcement could not be loaded')).toBeTruthy()
  })
})
