// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({
  getJob: vi.fn(),
  markJob: vi.fn(async () => ({})),
  claim: vi.fn(async () => [] as { id: string }[]),
  rule: vi.fn(),
  users: vi.fn(),
  prefs: vi.fn(),
  mainChurch: vi.fn(),
  platformChurch: vi.fn(),
  churchName: vi.fn(),
  push: vi.fn(),
  enqueueMail: vi.fn(async () => undefined),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/providers/outbox-job', () => ({
  GET_JOB: calls.getJob,
  MARK_JOB_STATE: calls.markJob,
  CLAIM_PENDING_JOBS: calls.claim,
}))
vi.mock('@/providers/notification', () => ({ GET_NOTIFICATION_RULE_BY_TYPE: calls.rule }))
vi.mock('@/providers/user', () => ({ LIST_ACTIVE_CUSTOMERS: calls.users }))
vi.mock('@/providers/mobile', () => ({
  GET_PREFERENCE_MAP_FOR_USERS: calls.prefs,
  GET_MAIN_CHURCH_IDS_FOR_USERS: calls.mainChurch,
  GET_PLATFORM_CHURCH_ID: calls.platformChurch,
  GET_CHURCH_NAME: calls.churchName,
}))
vi.mock('@/providers/mail-job', () => ({ ENQUEUE_MAIL_SEND: calls.enqueueMail }))
vi.mock('@/controller/general-prayer-send-job', () => ({
  mailOrigin: () => 'https://site.test',
  sendPushLeg: calls.push,
}))
vi.mock('@/utils/logger', () => ({ logger: calls.logger }))

import { processDonationReminderSendJob } from './donation-reminder-send-job'

const job = {
  id: 'job-1',
  state: 'RUNNING',
  attempts: 0,
  dedupe_key: 'donation_reminder.send:2026-11',
  payload: { period: '2026-11' },
}
const user = (id: string) => ({ id, name: id, email: `${id}@x.test` })

beforeEach(() => {
  vi.clearAllMocks()
  calls.getJob.mockResolvedValue(job)
  calls.rule.mockResolvedValue({
    id: 'r1',
    enabled: true,
    push_enabled: true,
    email_enabled: false,
  })
  calls.users.mockResolvedValue([user('u1'), user('u2'), user('u3')])
  calls.prefs.mockResolvedValue(new Map([['u2', new Map([['donation_reminder', false]])]]))
  calls.mainChurch.mockResolvedValue(new Map([['u1', 'c1']]))
  calls.platformChurch.mockResolvedValue('platform')
  calls.churchName.mockImplementation(async ({ churchId }: { churchId: string }) =>
    churchId === 'c1' ? 'St. Peter Parish' : 'Prayer 365',
  )
  calls.push.mockResolvedValue('succeeded')
})

describe('processDonationReminderSendJob', () => {
  it('reaches customers with no church, skips opted-out users, and deep-links per main church', async () => {
    await expect(processDonationReminderSendJob('job-1', 'r')).resolves.toBe('succeeded')

    expect(calls.push).toHaveBeenCalledTimes(2)
    const sent = calls.push.mock.calls.map(([arg]) => [arg.userIds, arg.data.churchId])
    expect(sent).toEqual([
      [['u1'], 'c1'],
      [['u3'], 'platform'],
    ])
    // The text names each user's own church and mentions both one-time and monthly giving.
    const [first, second] = calls.push.mock.calls.map(([arg]) => arg)
    expect(first.title).toBe('A gentle reminder to give')
    expect(first.body).toBe(
      'Support St. Peter Parish with a one-time gift or a monthly offering. God bless you.',
    )
    expect(second.body).toContain('Support Prayer 365 with')
    expect(calls.markJob).toHaveBeenCalledWith(expect.objectContaining({ state: 'SUCCEEDED' }))
  })

  it('does nothing when the rule is disabled', async () => {
    calls.rule.mockResolvedValue({
      id: 'r1',
      enabled: false,
      push_enabled: true,
      email_enabled: true,
    })
    await expect(processDonationReminderSendJob('job-1', 'r')).resolves.toBe('succeeded')
    expect(calls.users).not.toHaveBeenCalled()
  })

  it('queues one deduped email per eligible customer when email is on', async () => {
    calls.rule.mockResolvedValue({
      id: 'r1',
      enabled: true,
      push_enabled: false,
      email_enabled: true,
    })
    await processDonationReminderSendJob('job-1', 'r')

    expect(calls.enqueueMail).toHaveBeenCalledTimes(2)
    expect(calls.enqueueMail).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKeySuffix: 'donation_reminder:2026-11:u1' }),
    )
    expect(calls.push).not.toHaveBeenCalled()
  })

  it('skips a job that is not RUNNING', async () => {
    calls.getJob.mockResolvedValue({ ...job, state: 'SUCCEEDED' })
    await expect(processDonationReminderSendJob('job-1', 'r')).resolves.toBe('skipped')
  })
})
