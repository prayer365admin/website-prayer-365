// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rule: vi.fn(),
  enqueue: vi.fn(async () => ({ id: 'job-1' })),
  events: vi.fn(async () => [] as unknown[]),
  churches: vi.fn(async () => [] as unknown[]),
  logger: { info: vi.fn(), error: vi.fn() },
}))

vi.mock('@/providers/notification', () => ({
  GET_NOTIFICATION_RULE_BY_TYPE: mocks.rule,
  ENQUEUE_NOTIFICATION: mocks.enqueue,
  SCAN_EVENTS_STARTING_BETWEEN: mocks.events,
  LIST_APPROVED_CHURCH_IDS: mocks.churches,
}))
vi.mock('@/utils/logger', () => ({ logger: mocks.logger }))

import { scanDueDonationReminders, scanDueEventReminders } from './notification-schedule'

const NOW = new Date('2026-11-05T10:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.enqueue.mockResolvedValue({ id: 'job-1' })
  mocks.events.mockResolvedValue([])
  mocks.churches.mockResolvedValue([])
})

describe('scanDueEventReminders', () => {
  it('schedules one reminder per event at starts_at minus the rule offset', async () => {
    const startsAt = new Date('2026-11-05T10:30:00.000Z')
    mocks.rule.mockResolvedValue({ enabled: true, offset_minutes: 60 })
    mocks.events.mockResolvedValue([{ id: 'e1', church_id: 'c1', starts_at: startsAt }])

    await expect(scanDueEventReminders({ now: NOW })).resolves.toEqual({ enqueued: 1 })

    // Only events inside one offset window are considered.
    expect(mocks.events).toHaveBeenCalledWith({
      from: NOW,
      to: new Date('2026-11-05T11:00:00.000Z'),
    })
    expect(mocks.enqueue).toHaveBeenCalledWith({
      type: 'event_reminder',
      resourceId: 'e1',
      churchId: 'c1',
      dedupeKeySuffix: 'e1:60',
      availableAt: new Date('2026-11-05T09:30:00.000Z'),
    })
  })

  it('does nothing when the rule is missing, disabled or has no offset', async () => {
    mocks.rule.mockResolvedValueOnce(null)
    await expect(scanDueEventReminders({ now: NOW })).resolves.toEqual({ enqueued: 0 })

    mocks.rule.mockResolvedValueOnce({ enabled: false, offset_minutes: 60 })
    await expect(scanDueEventReminders({ now: NOW })).resolves.toEqual({ enqueued: 0 })

    mocks.rule.mockResolvedValueOnce({ enabled: true, offset_minutes: null })
    await expect(scanDueEventReminders({ now: NOW })).resolves.toEqual({ enqueued: 0 })

    expect(mocks.events).not.toHaveBeenCalled()
    expect(mocks.enqueue).not.toHaveBeenCalled()
  })
})

describe('scanDueDonationReminders', () => {
  it('enqueues one reminder per approved church for the ISO week', async () => {
    mocks.rule.mockResolvedValue({ enabled: true, recurrence: 'weekly' })
    mocks.churches.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }])

    await expect(scanDueDonationReminders({ now: NOW })).resolves.toEqual({ enqueued: 2 })
    expect(mocks.enqueue).toHaveBeenNthCalledWith(1, {
      type: 'donation_reminder',
      resourceId: 'c1',
      churchId: 'c1',
      dedupeKeySuffix: 'c1:2026-W45',
    })
    expect(mocks.enqueue).toHaveBeenNthCalledWith(2, {
      type: 'donation_reminder',
      resourceId: 'c2',
      churchId: 'c2',
      dedupeKeySuffix: 'c2:2026-W45',
    })
  })

  it('uses the calendar month for a monthly recurrence', async () => {
    mocks.rule.mockResolvedValue({ enabled: true, recurrence: 'monthly' })
    mocks.churches.mockResolvedValue([{ id: 'c1' }])

    await scanDueDonationReminders({ now: NOW })
    expect(mocks.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKeySuffix: 'c1:2026-11' }),
    )
  })

  it('does nothing without an active rule and recurrence', async () => {
    mocks.rule.mockResolvedValueOnce(null)
    await expect(scanDueDonationReminders({ now: NOW })).resolves.toEqual({ enqueued: 0 })

    mocks.rule.mockResolvedValueOnce({ enabled: true, recurrence: null })
    await expect(scanDueDonationReminders({ now: NOW })).resolves.toEqual({ enqueued: 0 })

    mocks.rule.mockResolvedValueOnce({ enabled: false, recurrence: 'weekly' })
    await expect(scanDueDonationReminders({ now: NOW })).resolves.toEqual({ enqueued: 0 })

    expect(mocks.churches).not.toHaveBeenCalled()
    expect(mocks.enqueue).not.toHaveBeenCalled()
  })

  it('keeps sweeping when one church is already enqueued for the period', async () => {
    mocks.rule.mockResolvedValue({ enabled: true, recurrence: 'weekly' })
    mocks.churches.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }])
    mocks.enqueue.mockRejectedValueOnce(new Error('unique violation'))

    await expect(scanDueDonationReminders({ now: NOW })).resolves.toEqual({ enqueued: 1 })
    expect(mocks.enqueue).toHaveBeenCalledTimes(2)
  })
})
