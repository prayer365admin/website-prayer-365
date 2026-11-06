import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({
  getJob: vi.fn(),
  markJob: vi.fn(async () => ({})),
  claim: vi.fn(async () => [] as { id: string }[]),
  rule: vi.fn(),
  content: vi.fn(),
  recipients: vi.fn(),
  prefs: vi.fn(),
  devices: vi.fn(),
  undelivered: vi.fn(),
  upsertDelivery: vi.fn(async () => ({ id: 'del-1', status: 'queued' })),
  markDelivery: vi.fn(async () => ({})),
  disableDevice: vi.fn(async () => ({})),
  send: vi.fn(),
  decrypt: vi.fn(() => 'fcm-token'),
  enqueueMail: vi.fn(async () => undefined),
}))

vi.mock('@/providers/outbox-job', () => ({
  GET_JOB: calls.getJob,
  MARK_JOB_STATE: calls.markJob,
  CLAIM_PENDING_JOBS: calls.claim,
}))
vi.mock('@/providers/notification', () => ({ GET_NOTIFICATION_RULE_BY_TYPE: calls.rule }))
vi.mock('@/providers/mobile', () => ({
  GET_NOTIFICATION_CONTENT: calls.content,
  GET_NOTIFICATION_RECIPIENTS: calls.recipients,
  GET_PREFERENCE_MAP_FOR_USERS: calls.prefs,
  GET_ACTIVE_DEVICES_FOR_USERS: calls.devices,
  FILTER_UNDELIVERED_DEVICES: calls.undelivered,
  UPSERT_NOTIFICATION_DELIVERY: calls.upsertDelivery,
  MARK_NOTIFICATION_DELIVERY: calls.markDelivery,
  MARK_DEVICE_DISABLED: calls.disableDevice,
}))
vi.mock('@/providers/push', () => ({ SEND_PUSH_BATCH: calls.send }))
vi.mock('@/providers/mail-job', () => ({ ENQUEUE_MAIL_SEND: calls.enqueueMail }))
vi.mock('@/utils/device-token', () => ({ decryptDeviceToken: calls.decrypt }))

import { processNotificationSendJob } from './notification-send-job'

const job = (over: Record<string, unknown> = {}) => ({
  id: 'job-1',
  state: 'RUNNING',
  attempts: 0,
  dedupe_key: 'notification.send:prayer_published:p1',
  resource_id: 'p1',
  payload: { type: 'prayer_published', churchId: 'c1' },
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  calls.getJob.mockResolvedValue(job())
  calls.rule.mockResolvedValue({
    id: 'rule-1',
    enabled: true,
    push_enabled: true,
    email_enabled: false,
  })
  calls.content.mockResolvedValue({
    title: 'New prayer from C',
    body: 'Title',
    churchName: 'C',
    churchSlug: 'c',
  })
  calls.recipients.mockResolvedValue([
    { user_id: 'u1', user: { email: 'u1@example.com', name: 'U1' } },
    { user_id: 'u2', user: { email: 'u2@example.com', name: 'U2' } },
  ])
  calls.prefs.mockResolvedValue(new Map([['u2', new Map([['daily_prayer', false]])]]))
  calls.devices.mockResolvedValue([{ id: 'd1', user_id: 'u1', token_ciphertext: 'cipher' }])
  calls.undelivered.mockResolvedValue(new Set(['d1']))
  calls.send.mockResolvedValue([{ token: 'fcm-token', ok: true, invalidToken: false }])
})

describe('notification.send worker', () => {
  it('skips a job that is not RUNNING', async () => {
    calls.getJob.mockResolvedValue(job({ state: 'PENDING' }))
    await expect(processNotificationSendJob('job-1', 'r1')).resolves.toBe('skipped')
  })

  it('fails without a payload', async () => {
    calls.getJob.mockResolvedValue(job({ payload: null }))
    await expect(processNotificationSendJob('job-1', 'r1')).resolves.toBe('failed')
    expect(calls.markJob).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'MISSING_PAYLOAD' }),
    )
  })

  it('fails when the trigger rule is absent (seed drift)', async () => {
    calls.rule.mockResolvedValue(null)
    await expect(processNotificationSendJob('job-1', 'r1')).resolves.toBe('failed')
    expect(calls.markJob).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'MISSING_RULE' }),
    )
  })

  it('sends only to recipients whose preference is not false', async () => {
    await expect(processNotificationSendJob('job-1', 'r1')).resolves.toBe('succeeded')
    expect(calls.send).toHaveBeenCalledTimes(1)
    expect(calls.upsertDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', deviceTokenId: 'd1' }),
    )
    expect(calls.markDelivery).toHaveBeenCalledWith({ id: 'del-1', status: 'sent' })
  })

  it('does not resend a device already marked sent', async () => {
    calls.undelivered.mockResolvedValue(new Set())
    await expect(processNotificationSendJob('job-1', 'r1')).resolves.toBe('succeeded')
    expect(calls.send).not.toHaveBeenCalled()
  })

  it('skips the push leg when the rule disables push', async () => {
    calls.rule.mockResolvedValue({
      id: 'rule-1',
      enabled: true,
      push_enabled: false,
      email_enabled: true,
    })
    await expect(processNotificationSendJob('job-1', 'r1')).resolves.toBe('succeeded')
    expect(calls.send).not.toHaveBeenCalled()
    expect(calls.enqueueMail).toHaveBeenCalledTimes(1)
  })

  it('enqueues one idempotent mail per eligible recipient', async () => {
    calls.rule.mockResolvedValue({
      id: 'rule-1',
      enabled: true,
      push_enabled: true,
      email_enabled: true,
    })
    await expect(processNotificationSendJob('job-1', 'r1')).resolves.toBe('succeeded')

    expect(calls.enqueueMail).toHaveBeenCalledTimes(1)
    expect(calls.enqueueMail).toHaveBeenCalledWith({
      dedupeKeySuffix: 'notification:notification.send:prayer_published:p1:u1',
      skipDuplicates: true,
      message: {
        from: expect.any(String),
        to: 'u1@example.com',
        subject: 'New prayer from C',
        template_name: 'notification-prayer',
        payload: {
          customerName: 'U1',
          churchName: 'C',
          body: 'Title',
          ctaLink: '/churches/c',
        },
        baseUrl: '',
      },
    })
  })

  it('does nothing but succeed when both channels are disabled', async () => {
    calls.rule.mockResolvedValue({
      id: 'rule-1',
      enabled: true,
      push_enabled: false,
      email_enabled: false,
    })
    await expect(processNotificationSendJob('job-1', 'r1')).resolves.toBe('succeeded')
    expect(calls.send).not.toHaveBeenCalled()
    expect(calls.enqueueMail).not.toHaveBeenCalled()
  })

  it('disables an invalid token and keeps going', async () => {
    calls.send.mockResolvedValue([
      {
        token: 'fcm-token',
        ok: false,
        invalidToken: true,
        errorCode: 'messaging/invalid-registration-token',
      },
    ])
    await expect(processNotificationSendJob('job-1', 'r1')).resolves.toBe('succeeded')
    expect(calls.disableDevice).toHaveBeenCalledWith({ deviceTokenId: 'd1' })
  })

  it('requeues on a transient provider failure', async () => {
    calls.send.mockResolvedValue([
      { token: 'fcm-token', ok: false, invalidToken: false, errorCode: 'messaging/internal-error' },
    ])
    await expect(processNotificationSendJob('job-1', 'r1')).resolves.toBe('requeued')
    expect(calls.markJob).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'PENDING', errorCode: 'PUSH_TRANSIENT' }),
    )
  })

  it('fails after the retry budget', async () => {
    calls.getJob.mockResolvedValue(job({ attempts: 3 }))
    calls.send.mockResolvedValue([{ token: 'fcm-token', ok: false, invalidToken: false }])
    await expect(processNotificationSendJob('job-1', 'r1')).resolves.toBe('failed')
  })
})
