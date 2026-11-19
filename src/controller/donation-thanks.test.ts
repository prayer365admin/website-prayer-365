// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({
  ensureRule: vi.fn(),
  devices: vi.fn(),
  undelivered: vi.fn(),
  upsert: vi.fn(async () => ({ id: 'del-1' })),
  mark: vi.fn(async () => ({})),
  disable: vi.fn(async () => ({})),
  churchName: vi.fn(),
  send: vi.fn(),
  logger: { warn: vi.fn() },
}))

vi.mock('@/providers/notification', () => ({ ENSURE_NOTIFICATION_RULE: calls.ensureRule }))
vi.mock('@/providers/mobile', () => ({
  GET_ACTIVE_DEVICES_FOR_USERS: calls.devices,
  FILTER_UNDELIVERED_DEVICES: calls.undelivered,
  UPSERT_NOTIFICATION_DELIVERY: calls.upsert,
  MARK_NOTIFICATION_DELIVERY: calls.mark,
  MARK_DEVICE_DISABLED: calls.disable,
  GET_CHURCH_NAME: calls.churchName,
}))
vi.mock('@/providers/push', () => ({ SEND_PUSH_BATCH: calls.send }))
vi.mock('@/utils/device-token', () => ({ decryptDeviceToken: () => 'fcm-token' }))
vi.mock('@/utils/logger', () => ({ logger: calls.logger }))

import { notifyDonationThanks } from './donation-thanks'

beforeEach(() => {
  vi.clearAllMocks()
  calls.churchName.mockResolvedValue('St. Peter Parish')
  calls.ensureRule.mockResolvedValue({ id: 'r1', enabled: true, push_enabled: true })
  calls.devices.mockResolvedValue([{ id: 'd1', user_id: 'u1', token_ciphertext: 'x' }])
  calls.undelivered.mockResolvedValue(new Set(['d1']))
  calls.send.mockResolvedValue([{ token: 'fcm-token', ok: true, invalidToken: false }])
})

describe('notifyDonationThanks', () => {
  it('pushes a donation-typed thank-you keyed on the payment', async () => {
    await notifyDonationThanks({ userId: 'u1', churchId: 'c1', providerPaymentId: 'pi_1' })

    expect(calls.undelivered).toHaveBeenCalledWith(
      expect.objectContaining({ eventKey: 'donation_thanks:pi_1' }),
    )
    expect(calls.send).toHaveBeenCalledWith([
      expect.objectContaining({
        data: expect.objectContaining({ type: 'donation', churchId: 'c1' }),
      }),
    ])
    expect(calls.mark).toHaveBeenCalledWith({ id: 'del-1', status: 'sent' })
  })

  it('falls back to a neutral name when the church cannot be resolved', async () => {
    calls.churchName.mockResolvedValue(null)
    await notifyDonationThanks({ userId: 'u1', churchId: 'c1', providerPaymentId: 'pi_2' })
    expect(calls.send).toHaveBeenCalledWith([
      expect.objectContaining({ body: expect.stringContaining('Your offering to your church') }),
    ])
  })

  it('does nothing for a guest gift (no user)', async () => {
    await notifyDonationThanks({ providerPaymentId: 'pi_1' })
    expect(calls.send).not.toHaveBeenCalled()
  })

  it('does not resend to a device that already got this payment', async () => {
    calls.undelivered.mockResolvedValue(new Set())
    await notifyDonationThanks({ userId: 'u1', providerPaymentId: 'pi_1' })
    expect(calls.send).not.toHaveBeenCalled()
  })

  it('never throws: a push failure is logged, not propagated', async () => {
    calls.send.mockRejectedValue(new Error('fcm down'))
    await expect(
      notifyDonationThanks({ userId: 'u1', providerPaymentId: 'pi_1' }),
    ).resolves.toBeUndefined()
    expect(calls.logger.warn).toHaveBeenCalled()
  })
})
