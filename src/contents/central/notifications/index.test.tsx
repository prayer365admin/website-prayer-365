import { renderWithProviders } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useNotificationRules = vi.hoisted(() => vi.fn())
const updateAny = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/data/notification', () => ({ useNotificationRules }))
vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({ updateAny }),
}))
vi.mock('@/components/common/dashboard/main-header', () => ({
  default: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}))

import ContentsCentralNotifications from './index'

const serverRules = [
  {
    id: 'r1',
    type: 'donation_reminder',
    enabled: true,
    push_enabled: true,
    email_enabled: false,
    offset_minutes: 60,
    recurrence: 'monthly',
    version: 3,
  },
  {
    id: 'r2',
    type: 'prayer_published',
    enabled: true,
    push_enabled: true,
    email_enabled: true,
    offset_minutes: null,
    recurrence: null,
    version: 1,
  },
  {
    id: 'r3',
    type: 'event_reminder',
    enabled: false,
    push_enabled: true,
    email_enabled: false,
    offset_minutes: 1440,
    recurrence: null,
    version: 2,
  },
  {
    id: 'r4',
    type: 'announcement_published',
    enabled: true,
    push_enabled: true,
    email_enabled: false,
    offset_minutes: 0,
    recurrence: null,
    version: 5,
  },
]

const hook = (overrides: Record<string, unknown> = {}) => ({
  data: serverRules,
  loading: false,
  saving: false,
  error: null,
  onSave: vi.fn().mockResolvedValue(undefined),
  ...overrides,
})

describe('ContentsCentralNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateAny.mockReturnValue({ granted: true })
  })

  it('lists every allowed rule type with defaults for missing rows', () => {
    useNotificationRules.mockReturnValue(hook({ data: [serverRules[0]] }))
    renderWithProviders(<ContentsCentralNotifications />)

    expect(screen.getByText('Donation Reminder')).toBeTruthy()
    expect(screen.getByText('Prayer Published')).toBeTruthy()
    expect(screen.getByText('Event Reminder')).toBeTruthy()
    expect(screen.getByText('Announcement Published')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /add|delete/i })).toBeNull()
  })

  it('saves only the changed fields with the row version', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    useNotificationRules.mockReturnValue(hook({ onSave }))
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralNotifications />)

    const save = screen.getByRole('button', { name: 'Save changes' })
    expect((save as HTMLButtonElement).disabled).toBe(true)

    await user.click(screen.getByRole('switch', { name: 'Event Reminder enabled' }))
    await user.click(save)

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([{ type: 'event_reminder', version: 2, enabled: true }]),
    )
  })

  it('sends the chosen allowlisted offset with the row version', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    useNotificationRules.mockReturnValue(hook({ onSave }))
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralNotifications />)

    await user.click(screen.getByRole('combobox', { name: 'Prayer Published reminder offset' }))
    // The portalled option list is the only reliable click target (the a11y mirror is 0×0).
    const atEventTime = document.querySelector<HTMLElement>(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="At event time"]',
    )
    expect(atEventTime).toBeTruthy()
    await user.click(atEventTime!)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        { type: 'prayer_published', version: 1, offset_minutes: 0 },
      ]),
    )
  })

  it('saves the email channel alone when only that switch changes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    useNotificationRules.mockReturnValue(hook({ onSave }))
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralNotifications />)

    await user.click(screen.getByRole('switch', { name: 'Event Reminder email' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        { type: 'event_reminder', version: 2, email_enabled: true },
      ]),
    )
  })

  it('saves the push channel alone when only that switch changes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    useNotificationRules.mockReturnValue(hook({ onSave }))
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralNotifications />)

    await user.click(screen.getByRole('switch', { name: 'Prayer Published push' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        { type: 'prayer_published', version: 1, push_enabled: false },
      ]),
    )
  })

  it('offers the schedule only on the donation reminder row and saves the recurrence', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    useNotificationRules.mockReturnValue(hook({ onSave }))
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralNotifications />)

    const schedules = screen.getAllByRole('combobox', { name: /schedule$/ })
    expect(schedules).toHaveLength(1)
    expect(screen.getByRole('combobox', { name: 'Donation Reminder schedule' })).toBeTruthy()

    await user.click(screen.getByRole('combobox', { name: 'Donation Reminder schedule' }))
    const weekly = document.querySelector<HTMLElement>(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="Every week"]',
    )
    expect(weekly).toBeTruthy()
    await user.click(weekly!)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        { type: 'donation_reminder', version: 3, recurrence: 'weekly' },
      ]),
    )
  })

  it('disables editing without the update permission', () => {
    updateAny.mockReturnValue({ granted: false })
    useNotificationRules.mockReturnValue(hook())
    renderWithProviders(<ContentsCentralNotifications />)

    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull()
    screen
      .getAllByRole('switch')
      .forEach((el) => expect((el as HTMLButtonElement).disabled).toBe(true))
    screen
      .getAllByRole('combobox')
      .forEach((el) => expect(el.closest('.ant-select-disabled')).toBeTruthy())
  })
})
