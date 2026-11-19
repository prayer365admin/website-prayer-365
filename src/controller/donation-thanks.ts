import { ENSURE_NOTIFICATION_RULE } from '@/providers/notification'
import {
  FILTER_UNDELIVERED_DEVICES,
  GET_ACTIVE_DEVICES_FOR_USERS,
  GET_CHURCH_NAME,
  MARK_DEVICE_DISABLED,
  MARK_NOTIFICATION_DELIVERY,
  UPSERT_NOTIFICATION_DELIVERY,
} from '@/providers/mobile'
import { SEND_PUSH_BATCH } from '@/providers/push'
import { decryptDeviceToken } from '@/utils/device-token'
import { logger } from '@/utils/logger'

/*
 * Donation thank-you push: sent after EVERY successful payment (one-off or each
 * subscription renewal) to the signed-in donor. Guest gifts have no user, so nothing is sent.
 *
 * Best effort and inline: the ledger write is what matters, so a push failure is logged
 * and never fails the payment-sync job. No preference toggle (the product lists none).
 * Dedupe: Stripe sends several events for one payment (payment_intent, charge, invoice),
 * all resolving to the same payment id. `notification_deliveries` is unique per
 * (rule, device, event key), so the event key below makes the repeats no-ops.
 */

const TRIGGER = 'donation_thanks'
const TITLE = 'Thank you for your gift!'
/** `recipient` is the church name, or a neutral fallback when it cannot be resolved. */
const body = (recipient: string) =>
  `Your offering to ${recipient} has been received. God bless you for your generosity.`

export const notifyDonationThanks = async ({
  userId,
  churchId,
  providerPaymentId,
}: {
  userId?: string
  churchId?: string
  providerPaymentId: string
}): Promise<void> => {
  if (!userId) return
  try {
    // Created on first use so no seed/migration is needed; an admin edit to it is kept.
    const rule = await ENSURE_NOTIFICATION_RULE({
      type: TRIGGER,
      push_enabled: true,
      email_enabled: false,
    })
    if (!rule.enabled || !rule.push_enabled) return

    const churchName = churchId ? await GET_CHURCH_NAME({ churchId }) : null
    const pushBody = body(churchName ?? 'your church')

    const eventKey = `${TRIGGER}:${providerPaymentId}`
    const devices = await GET_ACTIVE_DEVICES_FOR_USERS({ userIds: [userId] })
    const undelivered = await FILTER_UNDELIVERED_DEVICES({
      eventKey,
      deviceTokenIds: devices.map((device) => device.id),
    })
    const targets: { device: (typeof devices)[number]; token: string }[] = []
    for (const device of devices) {
      if (!undelivered.has(device.id)) continue
      try {
        targets.push({ device, token: decryptDeviceToken(device.token_ciphertext) })
      } catch {
        await MARK_DEVICE_DISABLED({ deviceTokenId: device.id })
      }
    }
    if (targets.length === 0) return

    const results = await SEND_PUSH_BATCH(
      targets.map((target) => ({
        token: target.token,
        title: TITLE,
        body: pushBody,
        data: { type: 'donation', messageId: eventKey, ...(churchId ? { churchId } : {}) },
      })),
    )
    for (let index = 0; index < results.length; index += 1) {
      const { device } = targets[index]
      const delivery = await UPSERT_NOTIFICATION_DELIVERY({
        ruleId: rule.id,
        userId: device.user_id,
        deviceTokenId: device.id,
        eventKey,
      })
      await MARK_NOTIFICATION_DELIVERY({
        id: delivery.id,
        status: results[index].ok ? 'sent' : 'failed',
      })
      if (!results[index].ok && results[index].invalidToken) {
        await MARK_DEVICE_DISABLED({ deviceTokenId: device.id })
      }
    }
  } catch (err) {
    logger.warn('donation_thanks_failed', {
      error_message: err instanceof Error ? err.message : String(err),
    })
  }
}
