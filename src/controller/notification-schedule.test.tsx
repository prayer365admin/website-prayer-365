// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rule: vi.fn(),
  enqueue: vi.fn(async () => ({ id: 'job-1' })),
  events: vi.fn(async () => [] as unknown[]),
  donationJob: vi.fn(async () => ({ count: 1 })),
  logger: { info: vi.fn(), error: vi.fn() },
}))

vi.mock('@/providers/notification', () => ({
  GET_NOTIFICATION_RULE_BY_TYPE: mocks.rule,
  ENQUEUE_NOTIFICATION: mocks.enqueue,
  SCAN_EVENTS_STARTING_BETWEEN: mocks.events,
  ENQUEUE_DONATION_REMINDER_SEND_JOB: mocks.donationJob,
}))
vi.mock('@/utils/logger', () => ({ logger: mocks.logger }))

import { scanDueDonationReminders, scanDueEventReminders } from './notification-schedule'

const NOW = new Date('2026-11-05T10:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.enqueue.mockResolvedValue({ id: 'job-1' })
  mocks.events.mockResolvedValue([])
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
  it('enqueues ONE all-customer job for the ISO week', async () => {
    mocks.rule.mockResolvedValue({ enabled: true, recurrence: 'weekly' })
    mocks.donationJob.mockResolvedValue({ count: 1 })

    await expect(scanDueDonationReminders({ now: NOW })).resolves.toEqual({ enqueued: 1 })
    expect(mocks.donationJob).toHaveBeenCalledWith({ periodKey: '2026-W45' })
  })

  it('uses the calendar month for a monthly recurrence', async () => {
    mocks.rule.mockResolvedValue({ enabled: true, recurrence: 'monthly' })

    await scanDueDonationReminders({ now: NOW })
    expect(mocks.donationJob).toHaveBeenCalledWith({ periodKey: '2026-11' })
  })

  it('does nothing without an active rule and recurrence', async () => {
    mocks.rule.mockResolvedValueOnce(null)
    await expect(scanDueDonationReminders({ now: NOW })).resolves.toEqual({ enqueued: 0 })

    mocks.rule.mockResolvedValueOnce({ enabled: true, recurrence: null })
    await expect(scanDueDonationReminders({ now: NOW })).resolves.toEqual({ enqueued: 0 })

    mocks.rule.mockResolvedValueOnce({ enabled: false, recurrence: 'weekly' })
    await expect(scanDueDonationReminders({ now: NOW })).resolves.toEqual({ enqueued: 0 })

    expect(mocks.donationJob).not.toHaveBeenCalled()
  })

  it('inserts nothing when the period job already exists (dedupe)', async () => {
    mocks.rule.mockResolvedValue({ enabled: true, recurrence: 'weekly' })
    mocks.donationJob.mockResolvedValue({ count: 0 })

    await expect(scanDueDonationReminders({ now: NOW })).resolves.toEqual({ enqueued: 0 })
  })
})
