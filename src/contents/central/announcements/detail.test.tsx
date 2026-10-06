import { pushMock, renderWithProviders, replaceMock } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  canUpdate: true,
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
    onCreate: m.onCreate,
    onUpdate: m.onUpdate,
    onPublish: m.onPublish,
    onUnpublish: m.onUnpublish,
  }),
}))
vi.mock('@/hooks/data/central', () => ({
  useCentralChurches: () => ({
    data: [{ id: 'c2', name: 'Hope', status: 'APPROVED' }],
    isLoading: false,
  }),
}))
vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    updateAny: (subject: string) => ({
      granted: subject === 'prayer_announcement_publication' ? m.canPublish : m.canUpdate,
    }),
    updateOwn: () => ({ granted: false }),
  }),
}))

import ContentsCentralAnnouncementDetail from './detail'

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

describe('ContentsCentralAnnouncementDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.canUpdate = true
    m.canPublish = true
    m.announcement = { data: undefined, loading: false, error: null }
  })

  it('creates a draft in the selected church and publishes it when switched on', async () => {
    m.onCreate.mockResolvedValue({ id: 'new-1', version: 1 })
    m.onPublish.mockResolvedValue({})
    renderWithProviders(<ContentsCentralAnnouncementDetail />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByTitle('Hope'))
    await user.type(screen.getByLabelText('Title'), ' Choir ')
    await user.type(screen.getByLabelText('Message'), 'Practice moved.')
    await user.click(screen.getByRole('switch', { name: 'Published' }))
    await user.click(screen.getByRole('button', { name: 'Create announcement' }))

    await waitFor(() =>
      expect(m.onCreate).toHaveBeenCalledWith({
        churchId: 'c2',
        title: 'Choir',
        body: 'Practice moved.',
      }),
    )
    expect(m.onPublish).toHaveBeenCalledWith({
      churchId: 'c2',
      announcementId: 'new-1',
      version: 1,
    })
    expect(pushMock).toHaveBeenCalledWith('/dashboard/central/announcements')
  })

  it('opens the saved draft when publishing after create fails', async () => {
    m.onCreate.mockResolvedValue({ id: 'new-1', version: 1 })
    m.onPublish.mockRejectedValue(new Error('conflict'))
    renderWithProviders(<ContentsCentralAnnouncementDetail />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByTitle('Hope'))
    await user.type(screen.getByLabelText('Title'), 'Choir')
    await user.type(screen.getByLabelText('Message'), 'Practice moved.')
    await user.click(screen.getByRole('switch', { name: 'Published' }))
    await user.click(screen.getByRole('button', { name: 'Create announcement' }))

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith('/dashboard/central/announcements/new-1'),
    )
  })

  it('saves edits with the current version and keeps the church fixed', async () => {
    m.announcement = { data: existing, loading: false, error: null }
    m.onUpdate.mockResolvedValue({ version: 4 })
    renderWithProviders(<ContentsCentralAnnouncementDetail id="a1" />)
    const user = userEvent.setup()

    expect(screen.getByText('Grace')).toBeTruthy()
    expect(screen.getByText('The church cannot be changed after creation.')).toBeTruthy()
    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'Parish dinner')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard/central/announcements'))
    expect(m.onUpdate).toHaveBeenCalledWith({
      churchId: 'c1',
      announcementId: 'a1',
      payload: { title: 'Parish dinner', body: 'Join us.', version: 3 },
    })
    expect(m.onPublish).not.toHaveBeenCalled()
    expect(m.onUnpublish).not.toHaveBeenCalled()
  })

  it('toggling the switch changes nothing until saved, without confirmation', async () => {
    m.announcement = { data: existing, loading: false, error: null }
    m.onPublish.mockResolvedValue({})
    renderWithProviders(<ContentsCentralAnnouncementDetail id="a1" />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('switch', { name: 'Published' }))
    expect(m.onPublish).not.toHaveBeenCalled()
    expect(screen.queryByText('Publish announcement?')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(m.onPublish).toHaveBeenCalledWith({
        churchId: 'c1',
        announcementId: 'a1',
        version: 3,
      }),
    )
    expect(m.onUpdate).not.toHaveBeenCalled()
  })

  it('returns a published announcement to draft when the content changes', async () => {
    m.announcement = {
      data: { ...existing, publishedAt: '2026-10-01T09:00:00.000Z', version: 4 },
      loading: false,
      error: null,
    }
    m.onUpdate.mockResolvedValue({ version: 5 })
    renderWithProviders(<ContentsCentralAnnouncementDetail id="a1" />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Message'), ' Bring a dish.')
    await user.click(screen.getByRole('switch', { name: 'Published' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard/central/announcements'))
    expect(m.onUpdate).toHaveBeenCalledWith({
      churchId: 'c1',
      announcementId: 'a1',
      payload: { title: 'Parish lunch', body: 'Join us. Bring a dish.', version: 4 },
    })
    // The edit itself already returned it to draft, so no status call is needed.
    expect(m.onUnpublish).not.toHaveBeenCalled()
    expect(m.onPublish).not.toHaveBeenCalled()
  })

  it('publishes again with the updated version when the switch is left on', async () => {
    m.announcement = {
      data: { ...existing, publishedAt: '2026-10-01T09:00:00.000Z', version: 4 },
      loading: false,
      error: null,
    }
    m.onUpdate.mockResolvedValue({ version: 5 })
    m.onPublish.mockResolvedValue({})
    renderWithProviders(<ContentsCentralAnnouncementDetail id="a1" />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Message'), ' Bring a dish.')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(m.onPublish).toHaveBeenCalledWith({
        churchId: 'c1',
        announcementId: 'a1',
        version: 5,
      }),
    )
    expect(m.onUnpublish).not.toHaveBeenCalled()
  })

  it('disables the published switch without the publication permission', () => {
    m.canPublish = false
    m.announcement = { data: existing, loading: false, error: null }
    renderWithProviders(<ContentsCentralAnnouncementDetail id="a1" />)

    const toggle = screen.getByRole('switch', { name: 'Published' }) as HTMLButtonElement
    expect(toggle.disabled).toBe(true)
  })

  it('stays on the page when the status change fails after saving', async () => {
    m.announcement = { data: existing, loading: false, error: null }
    m.onPublish.mockRejectedValue(new Error('conflict'))
    renderWithProviders(<ContentsCentralAnnouncementDetail id="a1" />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('switch', { name: 'Published' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(m.onPublish).toHaveBeenCalled())
    expect(pushMock).not.toHaveBeenCalled()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('shows a load error for a missing or out-of-scope announcement', () => {
    m.announcement = { data: undefined, loading: false, error: new Error('404') }
    renderWithProviders(<ContentsCentralAnnouncementDetail id="missing" />)

    expect(screen.getByText('Announcement could not be loaded')).toBeTruthy()
  })
})
