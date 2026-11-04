import { beforeEach, describe, expect, it, vi } from 'vitest'

const auditCreate = vi.fn(async () => ({}))

vi.mock('@/utils/db-transaction', () => ({
  dbTransaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn({ auditLog: { create: auditCreate } }),
  ),
}))
vi.mock('@/providers/mobile', () => ({
  GET_NOTIFICATION_PREFERENCES: vi.fn(),
  UPSERT_NOTIFICATION_PREFERENCES: vi.fn(),
  UPSERT_DEVICE_TOKEN: vi.fn(),
  DISABLE_DEVICE_TOKEN: vi.fn(),
  GET_CHECK_IN_ACK: vi.fn(),
  CREATE_CHECKIN: vi.fn(),
  CREATE_ANALYTICS_EVENTS: vi.fn(),
  COUNT_RECENT_USER_REQUESTS: vi.fn(),
  CREATE_USER_REQUEST: vi.fn(),
  GET_HOME: vi.fn(),
  GET_ME_PROFILE: vi.fn(),
  GET_PUBLIC_CHURCH: vi.fn(),
  GET_PUBLISHED_PRAYER: vi.fn(),
  GET_USER_REQUEST_ACK: vi.fn(),
  LIST_MY_CHURCHES: vi.fn(),
  LIST_PUBLIC_ANNOUNCEMENTS: vi.fn(),
  LIST_PUBLIC_CHURCHES: vi.fn(),
  LIST_PUBLIC_EVENTS: vi.fn(),
  LIST_PUBLISHED_PRAYERS: vi.fn(),
  SET_FOLLOW: vi.fn(),
  UPDATE_ME_PROFILE: vi.fn(),
}))
vi.mock('@/utils/idempotency', () => ({ withIdempotency: vi.fn() }))

import {
  DISABLE_DEVICE_TOKEN,
  GET_CHECK_IN_ACK,
  GET_NOTIFICATION_PREFERENCES,
  UPSERT_DEVICE_TOKEN,
  UPSERT_NOTIFICATION_PREFERENCES,
} from '@/providers/mobile'
import { withIdempotency } from '@/utils/idempotency'
import {
  checkIn,
  getNotificationPreferences,
  registerDevice,
  revokeDevice,
  saveNotificationPreferences,
} from './mobile'

const prefs = {
  dailyPrayer: true,
  sundayService: true,
  churchEvents: true,
  announcements: true,
  platformInformation: true,
  donationReminder: false,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('notification preferences controller', () => {
  it('reads preferences for the session user', async () => {
    vi.mocked(GET_NOTIFICATION_PREFERENCES).mockResolvedValue(prefs)
    await expect(getNotificationPreferences({ userId: 'u1' })).resolves.toEqual(prefs)
  })

  it('saves all six preferences and audits once', async () => {
    vi.mocked(GET_NOTIFICATION_PREFERENCES).mockResolvedValue(prefs)
    await saveNotificationPreferences({ userId: 'u1', input: prefs, requestId: 'r1' })
    expect(UPSERT_NOTIFICATION_PREFERENCES).toHaveBeenCalledWith(
      { userId: 'u1', prefs },
      expect.anything(),
    )
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'notification_preferences.update' }),
      }),
    )
  })
})

describe('device controller', () => {
  it('registers a device and audits the binding', async () => {
    vi.mocked(UPSERT_DEVICE_TOKEN).mockResolvedValue({
      id: 'd1',
      installation_id: 'install-1',
      platform: 'ios',
      created_at: new Date('2026-10-30T10:00:00Z'),
    } as never)

    await expect(
      registerDevice({
        userId: 'u1',
        installationId: 'install-1',
        input: { platform: 'ios', provider: 'fcm', token: 'fcm-token-1234567890' },
        requestId: 'r1',
      }),
    ).resolves.toMatchObject({ installationId: 'install-1', provider: 'fcm' })
  })

  it('revokes idempotently and audits no_change', async () => {
    vi.mocked(DISABLE_DEVICE_TOKEN).mockResolvedValue({ count: 0 } as never)
    await revokeDevice({ userId: 'u1', installationId: 'install-1', requestId: 'r1' })
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ outcome: 'no_change' }) }),
    )
  })
})

describe('check-in replay (AA-1)', () => {
  it('returns the stored ack on an idempotency replay', async () => {
    const ack = {
      id: 'check-1',
      churchId: 'c1',
      occurredAt: '2026-10-30T10:00:00.000Z',
      localDate: '2026-10-30',
    }
    vi.mocked(withIdempotency).mockResolvedValue({ fresh: false, resource_id: 'check-1' })
    vi.mocked(GET_CHECK_IN_ACK).mockResolvedValue(ack)

    await expect(
      checkIn({ userId: 'u1', churchId: 'c1', idempotencyKey: 'k1', requestId: 'r1' }),
    ).resolves.toEqual(ack)
  })

  it('never fabricates an empty ack when the row is gone', async () => {
    vi.mocked(withIdempotency).mockResolvedValue({ fresh: false, resource_id: 'missing' })
    vi.mocked(GET_CHECK_IN_ACK).mockResolvedValue(null)

    await expect(
      checkIn({ userId: 'u1', churchId: 'c1', idempotencyKey: 'k1', requestId: 'r1' }),
    ).rejects.toMatchObject({ code: 404 })
  })
})
