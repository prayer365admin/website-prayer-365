// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

type PushMessage = { token: string; title: string; body: string; data: Record<string, string> }
type PushResult = { token: string; ok: boolean; invalidToken: boolean; errorCode?: string }
type MailArgs = {
  dedupeKeySuffix: string
  skipDuplicates: boolean
  message: { to: string; subject: string; template_name: string; payload: Record<string, unknown> }
}

const calls = vi.hoisted(() => ({
  getJob: vi.fn(),
  markJob: vi.fn(async () => ({})),
  claim: vi.fn(async () => [] as { id: string }[]),
  rule: vi.fn(),
  prayer: vi.fn(),
  activeUsers: vi.fn(),
  prefs: vi.fn(),
  devices: vi.fn(),
  undelivered: vi.fn(),
  upsertDelivery: vi.fn(async () => ({ id: 'del-1', status: 'queued' })),
  markDelivery: vi.fn(async () => ({})),
  disableDevice: vi.fn(async () => ({})),
  send: vi.fn<(messages: PushMessage[]) => Promise<PushResult[]>>(),
  decrypt: vi.fn(() => 'fcm-token'),
  enqueueMail: vi.fn<(args: MailArgs) => Promise<void>>(async () => undefined),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/providers/outbox-job', () => ({
  GET_JOB: calls.getJob,
  MARK_JOB_STATE: calls.markJob,
  CLAIM_PENDING_JOBS: calls.claim,
}))
vi.mock('@/providers/notification', () => ({ GET_NOTIFICATION_RULE_BY_TYPE: calls.rule }))
vi.mock('@/providers/general-prayer', () => ({ GET_GENERAL_PRAYER_BY_ID: calls.prayer }))
vi.mock('@/providers/user', () => ({ LIST_ACTIVE_USERS: calls.activeUsers }))
vi.mock('@/providers/mobile', () => ({
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
vi.mock('@/utils/logger', () => ({ logger: calls.logger }))

import {
  generalPrayerMailParagraphs,
  mailOrigin,
  processGeneralPrayerSendJob,
} from './general-prayer-send-job'

const DATE = '2026-11-13'

const job = (over: Record<string, unknown> = {}) => ({
  id: 'job-1',
  state: 'RUNNING',
  attempts: 0,
  dedupe_key: `general_prayer.send:${DATE}`,
  resource_id: 'gp-2',
  payload: { date: DATE },
  ...over,
})

const prayer = (over: Record<string, unknown> = {}) => ({
  id: 'gp-2',
  slug: 'paivapalve-2',
  sequence: 2,
  title: 'Et su silmad oleksid lahti',
  introduction: null,
  body: '<p>Armas Jumal, ma tänan Sind kiriku eest.</p>',
  verse: 'Et su silmad oleksid lahti ööd ja päevad.',
  verse_reference: '1Kn 8,29',
  liturgical_note: null,
  references: null,
  language_code: 'et',
  audio_status: 'READY',
  audio_asset_id: 'a1',
  provider_request_id: null,
  last_error_code: null,
  audio_generated_at: new Date('2026-11-13T00:00:00.000Z'),
  is_active: true,
  version: 1,
  created_at: new Date('2026-11-01T00:00:00.000Z'),
  updated_at: null,
  audio_asset: {
    object_key: 'media/general_prayer/generated_audio/a.mp3',
    byte_size: BigInt(1),
    status: 'READY',
  },
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  calls.getJob.mockResolvedValue(job())
  calls.rule.mockResolvedValue({
    id: 'rule-gp',
    enabled: true,
    push_enabled: true,
    email_enabled: true,
  })
  calls.prayer.mockResolvedValue(prayer())
  calls.activeUsers.mockResolvedValue([
    { id: 'u1', name: 'U1', email: 'u1@example.com' },
    { id: 'u2', name: 'U2', email: 'u2@example.com' },
  ])
  calls.prefs.mockResolvedValue(new Map([['u2', new Map([['daily_prayer', false]])]]))
  calls.devices.mockResolvedValue([{ id: 'd1', user_id: 'u1', token_ciphertext: 'cipher' }])
  calls.undelivered.mockResolvedValue(new Set(['d1']))
  calls.send.mockResolvedValue([{ token: 'fcm-token', ok: true, invalidToken: false }])
})

describe('generalPrayerMailParagraphs', () => {
  it('turns stored HTML into plain-text paragraphs', () => {
    expect(generalPrayerMailParagraphs('<p>Esimene lõik.</p><p>Teine lõik.</p>')).toEqual([
      'Esimene lõik.',
      'Teine lõik.',
    ])
  })

  it('drops empty paragraphs and keeps inline formatting as text', () => {
    expect(generalPrayerMailParagraphs('<p><em>Jutlus:</em> 2Kr 5,10a</p><p> </p>')).toEqual([
      'Jutlus: 2Kr 5,10a',
    ])
  })
})

describe('mailOrigin', () => {
  it('uses the configured site origin without a trailing slash', () => {
    expect(mailOrigin({ BASE_URL: 'https://prayer365.eu/', APP_ENV: 'PROD' })).toBe(
      'https://prayer365.eu',
    )
  })

  it('falls back to the dev server locally, so the CTA still opens', () => {
    expect(mailOrigin({ BASE_URL: '', APP_ENV: 'local' })).toBe('http://localhost:3000')
  })

  it('refuses an origin in production: a relative CTA is a dead link in mail', () => {
    expect(mailOrigin({ BASE_URL: '', APP_ENV: 'PROD' })).toBe('')
    expect(mailOrigin({ APP_ENV: 'prod' })).toBe('')
  })
})

describe('general_prayer.send worker', () => {
  it('skips a job that is not RUNNING', async () => {
    calls.getJob.mockResolvedValue(job({ state: 'PENDING' }))
    await expect(processGeneralPrayerSendJob('job-1', 'r1')).resolves.toBe('skipped')
    expect(calls.prayer).not.toHaveBeenCalled()
  })

  it('fails with MISSING_BASE_URL in production instead of mailing relative links', async () => {
    const previous = { base: process.env.BASE_URL, app: process.env.APP_ENV }
    process.env.BASE_URL = ''
    process.env.APP_ENV = 'PROD'
    try {
      await expect(processGeneralPrayerSendJob('job-1', 'r1')).resolves.toBe('failed')
      expect(calls.markJob).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'FAILED', errorCode: 'MISSING_BASE_URL' }),
      )
      expect(calls.enqueueMail).not.toHaveBeenCalled()
    } finally {
      process.env.BASE_URL = previous.base
      process.env.APP_ENV = previous.app
    }
  })

  it('fails with MISSING_RULE when the trigger row is absent', async () => {
    calls.rule.mockResolvedValue(null)
    await expect(processGeneralPrayerSendJob('job-1', 'r1')).resolves.toBe('failed')
    expect(calls.markJob).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'FAILED', errorCode: 'MISSING_RULE' }),
    )
    expect(calls.enqueueMail).not.toHaveBeenCalled()
    expect(calls.send).not.toHaveBeenCalled()
  })

  it('succeeds without sending when the rule is disabled', async () => {
    calls.rule.mockResolvedValue({
      id: 'rule-gp',
      enabled: false,
      push_enabled: true,
      email_enabled: true,
    })
    await expect(processGeneralPrayerSendJob('job-1', 'r1')).resolves.toBe('succeeded')
    expect(calls.activeUsers).not.toHaveBeenCalled()
    expect(calls.enqueueMail).not.toHaveBeenCalled()
    expect(calls.send).not.toHaveBeenCalled()
  })

  it('skips an inactive prayer with a visible reason instead of sending', async () => {
    calls.prayer.mockResolvedValue(prayer({ is_active: false }))
    await expect(processGeneralPrayerSendJob('job-1', 'r1')).resolves.toBe('succeeded')
    expect(calls.markJob).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'SUCCEEDED', errorCode: 'PRAYER_INACTIVE' }),
    )
    expect(calls.enqueueMail).not.toHaveBeenCalled()
    expect(calls.send).not.toHaveBeenCalled()
  })

  it('excludes a user who turned daily_prayer off from both channels', async () => {
    await expect(processGeneralPrayerSendJob('job-1', 'r1')).resolves.toBe('succeeded')

    const mailed = calls.enqueueMail.mock.calls.map(([args]) => args.message.to)
    expect(mailed).toEqual(['u1@example.com'])
    expect(calls.send).toHaveBeenCalledTimes(1)
    expect(calls.send.mock.calls[0][0]).toHaveLength(1)
  })

  it('includes users with no preference row (missing = ON) and users with no church', async () => {
    calls.prefs.mockResolvedValue(new Map())
    await processGeneralPrayerSendJob('job-1', 'r1')
    expect(calls.enqueueMail).toHaveBeenCalledTimes(2)
  })

  it('emails a user with no device; no push is attempted for them', async () => {
    // Audience membership comes from the user table, never user_churches (D-GP-1).
    calls.prefs.mockResolvedValue(new Map())
    calls.devices.mockResolvedValue([])
    await expect(processGeneralPrayerSendJob('job-1', 'r1')).resolves.toBe('succeeded')
    expect(calls.enqueueMail).toHaveBeenCalledTimes(2)
    expect(calls.send).not.toHaveBeenCalled()
  })

  it('sends the documented push payload and the mail contract', async () => {
    await processGeneralPrayerSendJob('job-1', 'r1')

    const pushTargets = calls.send.mock.calls[0][0]
    expect(pushTargets[0].title).toBe('Et su silmad oleksid lahti')
    expect(pushTargets[0].data).toEqual({
      type: 'general_prayer',
      slug: 'paivapalve-2',
      date: DATE,
    })

    expect(calls.enqueueMail).toHaveBeenCalledWith({
      dedupeKeySuffix: `general_prayer:${DATE}:u1`,
      skipDuplicates: true,
      message: expect.objectContaining({
        to: 'u1@example.com',
        subject: 'Et su silmad oleksid lahti',
        template_name: 'notification-general-prayer',
        payload: expect.objectContaining({
          customerName: 'U1',
          date: '13.11.2026',
          ctaLink: expect.stringContaining('/prayers/general/paivapalve-2'),
          // Plain text, never stored HTML: the mail pipeline escapes every value.
          body: 'Armas Jumal, ma tänan Sind kiriku eest.',
          bodyParagraphs: ['Armas Jumal, ma tänan Sind kiriku eest.'],
        }),
      }),
    })
  })

  it('records one delivery per device with the job dedupe key', async () => {
    await processGeneralPrayerSendJob('job-1', 'r1')
    expect(calls.upsertDelivery).toHaveBeenCalledWith({
      ruleId: 'rule-gp',
      userId: 'u1',
      deviceTokenId: 'd1',
      eventKey: `general_prayer.send:${DATE}`,
    })
    expect(calls.markDelivery).toHaveBeenCalledWith({ id: 'del-1', status: 'sent' })
  })

  it('does not push again on a replay of the same job', async () => {
    calls.undelivered.mockResolvedValue(new Set())
    await expect(processGeneralPrayerSendJob('job-1', 'r1')).resolves.toBe('succeeded')
    expect(calls.send).not.toHaveBeenCalled()
    expect(calls.markJob).toHaveBeenCalledWith(expect.objectContaining({ state: 'SUCCEEDED' }))
  })

  it('survives a device whose token cannot be decrypted', async () => {
    // One corrupt row must not fail the whole day's send.
    calls.decrypt.mockImplementationOnce(() => {
      throw new Error('Invalid device token payload')
    })
    await expect(processGeneralPrayerSendJob('job-1', 'r1')).resolves.toBe('succeeded')
    expect(calls.disableDevice).toHaveBeenCalledWith({ deviceTokenId: 'd1' })
    expect(calls.markDelivery).toHaveBeenCalledWith({ id: 'del-1', status: 'failed' })
    // No pushable target left: the leg is done, not failed.
    expect(calls.send).not.toHaveBeenCalled()
    // Mail still went out: the email leg runs before push.
    expect(calls.enqueueMail).toHaveBeenCalledTimes(1)
  })

  it('still pushes to the healthy devices of the same batch', async () => {
    calls.devices.mockResolvedValue([
      { id: 'd1', user_id: 'u1', token_ciphertext: 'broken' },
      { id: 'd2', user_id: 'u1', token_ciphertext: 'cipher' },
    ])
    calls.undelivered.mockResolvedValue(new Set(['d1', 'd2']))
    calls.decrypt.mockImplementationOnce(() => {
      throw new Error('Invalid device token payload')
    })
    calls.upsertDelivery.mockResolvedValueOnce({ id: 'del-bad', status: 'queued' })
    calls.upsertDelivery.mockResolvedValueOnce({ id: 'del-good', status: 'queued' })

    await expect(processGeneralPrayerSendJob('job-1', 'r1')).resolves.toBe('succeeded')
    const pushed = calls.send.mock.calls[0][0]
    expect(pushed).toHaveLength(1)
    expect(calls.disableDevice).toHaveBeenCalledWith({ deviceTokenId: 'd1' })
    expect(calls.markDelivery).toHaveBeenCalledWith({ id: 'del-good', status: 'sent' })
  })

  it('disables an invalid token instead of retrying it forever', async () => {
    calls.send.mockResolvedValue([
      {
        token: 'fcm-token',
        ok: false,
        invalidToken: true,
        errorCode: 'messaging/registration-token-not-registered',
      },
    ])
    await expect(processGeneralPrayerSendJob('job-1', 'r1')).resolves.toBe('succeeded')
    expect(calls.disableDevice).toHaveBeenCalledWith({ deviceTokenId: 'd1' })
    expect(calls.markDelivery).toHaveBeenCalledWith({ id: 'del-1', status: 'failed' })
  })

  it('requeues with backoff on a transient push failure', async () => {
    calls.send.mockResolvedValue([
      { token: 'fcm-token', ok: false, invalidToken: false, errorCode: 'messaging/internal-error' },
    ])
    await expect(processGeneralPrayerSendJob('job-1', 'r1')).resolves.toBe('requeued')
    expect(calls.markJob).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'PENDING', errorCode: 'PUSH_TRANSIENT' }),
    )
  })

  it('fails the job when the retry budget is spent', async () => {
    calls.getJob.mockResolvedValue(job({ attempts: 3 }))
    calls.send.mockResolvedValue([
      { token: 'fcm-token', ok: false, invalidToken: false, errorCode: 'messaging/internal-error' },
    ])
    await expect(processGeneralPrayerSendJob('job-1', 'r1')).resolves.toBe('failed')
    expect(calls.markJob).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'FAILED', errorCode: 'PUSH_FAILED' }),
    )
  })

  it('requeues with an advanced cursor while the audience has more users', async () => {
    // SEND_CHUNK is 500 by default; a full chunk means "there may be more".
    const audience = Array.from({ length: 500 }, (_, index) => ({
      id: `u${String(index).padStart(4, '0')}`,
      name: `U${index}`,
      email: `u${index}@example.com`,
    }))
    calls.activeUsers.mockResolvedValue(audience)
    calls.devices.mockResolvedValue([])

    await expect(processGeneralPrayerSendJob('job-1', 'r1')).resolves.toBe('requeued')
    expect(calls.markJob).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'PENDING',
        payload: { date: DATE, cursor: 'u0499' },
      }),
    )
  })

  it('resumes from the stored cursor', async () => {
    calls.getJob.mockResolvedValue(job({ payload: { date: DATE, cursor: 'u0007' } }))
    await processGeneralPrayerSendJob('job-1', 'r1')
    expect(calls.activeUsers).toHaveBeenCalledWith({ cursor: 'u0007', limit: 500 })
  })

  it('fails with MISSING_CONTENT when the prayer row disappeared', async () => {
    calls.prayer.mockResolvedValue(null)
    await expect(processGeneralPrayerSendJob('job-1', 'r1')).resolves.toBe('failed')
    expect(calls.markJob).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'MISSING_CONTENT' }),
    )
  })

  it('owns only its own channel legs: no church recipient/content reads', async () => {
    await processGeneralPrayerSendJob('job-1', 'r1')
    expect(calls.getJob).toHaveBeenCalledTimes(1)
    expect(calls.claim).not.toHaveBeenCalled()
  })
})
