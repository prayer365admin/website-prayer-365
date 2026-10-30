import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  canUpdate: true,
  canPublish: true,
  canDelete: true,
  onPublish: vi.fn(),
  onUnpublish: vi.fn(),
  onDelete: vi.fn(),
}))
const useCentralAnnouncements = vi.hoisted(() => vi.fn())
const editorProps = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/data/announcement', () => ({
  useCentralAnnouncements,
  useAnnouncementActions: () => ({
    onPublish: m.onPublish,
    onUnpublish: m.onUnpublish,
    onDelete: m.onDelete,
  }),
}))
vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    updateAny: (subject: string) => ({
      granted: subject === 'prayer_announcement_publication' ? m.canPublish : m.canUpdate,
    }),
    updateOwn: () => ({ granted: false }),
    deleteAny: () => ({ granted: m.canDelete }),
    deleteOwn: () => ({ granted: false }),
    createAny: () => ({ granted: true }),
    createOwn: () => ({ granted: true }),
  }),
  useAccessSubjectPermission: () => ({
    canUpdate: m.canUpdate,
    canDelete: m.canDelete,
  }),
}))
vi.mock('@/components/common/search-input', () => ({
  default: ({ placeholder }: { placeholder: string }) => (
    <input aria-label={placeholder || 'Search'} />
  ),
}))
vi.mock('./editor-drawer', () => ({
  default: (props: { announcementId?: string; mode?: string; onClose: () => void }) => {
    editorProps(props)
    return <div role="dialog" aria-label={`Editor ${props.mode}`} />
  },
}))

import ContentsCentralAnnouncements from './index'

const row = (overrides = {}) => ({
  id: 'a1',
  churchId: 'c1',
  title: 'Parish lunch',
  body: 'Join us after Sunday Mass.',
  publishedAt: '2026-10-01T09:00:00.000Z',
  version: 2,
  createdAt: '2026-09-30T09:00:00.000Z',
  church: { name: 'Grace', timezone: 'Europe/Tallinn' },
  ...overrides,
})

describe('ContentsCentralAnnouncements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.canUpdate = true
    m.canPublish = true
    m.canDelete = true
    m.onPublish.mockResolvedValue(undefined)
    m.onUnpublish.mockResolvedValue(undefined)
    m.onDelete.mockResolvedValue(undefined)
  })

  it('lists announcements with their church and status', () => {
    useCentralAnnouncements.mockReturnValue({
      data: [
        row(),
        row({
          id: 'a2',
          churchId: 'c2',
          title: 'Choir',
          publishedAt: null,
          church: { name: 'Hope', timezone: 'UTC' },
        }),
      ],
      total: 2,
      loading: false,
      error: null,
    })
    renderWithProviders(<ContentsCentralAnnouncements />)

    expect(screen.getByRole('heading', { name: 'Announcements' })).toBeTruthy()
    expect(screen.getByText('Churches announcements')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/dashboard')
    expect(screen.getByRole('columnheader', { name: 'Church' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Grace' }).getAttribute('href')).toBe(
      '/dashboard/churches/c1/announcements',
    )
    expect(screen.getByRole('link', { name: 'Hope' }).getAttribute('href')).toBe(
      '/dashboard/churches/c2/announcements',
    )
    expect(screen.getByText('Published')).toBeTruthy()
    expect(screen.getByText('Draft')).toBeTruthy()
    expect(screen.getByText('Showing 1 - 2 of 2 announcements')).toBeTruthy()
    expect(useCentralAnnouncements).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10, orderBy: 'created_at' }),
    )
  })

  it('shows a load error', () => {
    useCentralAnnouncements.mockReturnValue({
      data: undefined,
      total: undefined,
      loading: false,
      error: new Error('offline'),
    })
    renderWithProviders(<ContentsCentralAnnouncements />)

    expect(screen.getByText('Announcements could not be loaded')).toBeTruthy()
  })

  it('offers a published-at range filter and a search box', () => {
    useCentralAnnouncements.mockReturnValue({ data: [], total: 0, loading: false, error: null })
    renderWithProviders(<ContentsCentralAnnouncements />)

    expect(screen.getByPlaceholderText('Published from')).toBeTruthy()
    expect(screen.getByPlaceholderText('Published until')).toBeTruthy()
    expect(screen.getByLabelText(/search announcement/i)).toBeTruthy()
    expect(useCentralAnnouncements).toHaveBeenCalledWith(
      expect.objectContaining({ publishedFrom: undefined, publishedTo: undefined }),
    )
  })

  it('opens the drawer in create mode from the header button', async () => {
    useCentralAnnouncements.mockReturnValue({ data: [], total: 0, loading: false, error: null })
    renderWithProviders(<ContentsCentralAnnouncements />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /New Announcements/ }))

    expect(screen.getByRole('dialog', { name: 'Editor create' })).toBeTruthy()
    expect(editorProps).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'create', announcementId: undefined }),
    )
  })

  it('opens the drawer in edit mode from the row actions', async () => {
    useCentralAnnouncements.mockReturnValue({
      data: [row()],
      total: 1,
      loading: false,
      error: null,
    })
    renderWithProviders(<ContentsCentralAnnouncements />)
    const user = userEvent.setup()

    await user.click(screen.getByLabelText('edit'))
    expect(editorProps).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'edit', announcementId: 'a1' }),
    )
  })

  it('publishes and unpublishes announcements with confirmation', async () => {
    useCentralAnnouncements.mockReturnValue({
      data: [
        row({
          id: 'a2',
          churchId: 'c2',
          publishedAt: null,
          church: { name: 'Hope', timezone: 'UTC' },
        }),
      ],
      total: 1,
      loading: false,
      error: null,
    })
    renderWithProviders(<ContentsCentralAnnouncements />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /^publish /i }))
    await user.click(await screen.findByRole('button', { name: 'Publish now' }))
    expect(m.onPublish).toHaveBeenCalledWith({ announcementId: 'a2', churchId: 'c2', version: 2 })
  })

  it('hides edit and publish from read-only users', () => {
    m.canUpdate = false
    m.canPublish = false
    useCentralAnnouncements.mockReturnValue({
      data: [row()],
      total: 1,
      loading: false,
      error: null,
    })
    renderWithProviders(<ContentsCentralAnnouncements />)

    expect(screen.queryByLabelText('edit')).toBeNull()
    expect(screen.queryByRole('button', { name: /^publish /i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^unpublish /i })).toBeNull()
  })

  it('soft-deletes a row against its own church after confirmation', async () => {
    useCentralAnnouncements.mockReturnValue({
      data: [
        row({ id: 'a2', churchId: 'c2', version: 5, church: { name: 'Hope', timezone: 'UTC' } }),
      ],
      total: 1,
      loading: false,
      error: null,
    })
    renderWithProviders(<ContentsCentralAnnouncements />)
    const user = userEvent.setup()

    await user.click(screen.getByLabelText('delete'))
    await user.click(await screen.findByRole('button', { name: 'OK' }))

    expect(m.onDelete).toHaveBeenCalledWith({ announcementId: 'a2', churchId: 'c2', version: 5 })
  })
})
