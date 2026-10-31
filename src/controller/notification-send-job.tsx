import crypto from 'node:crypto'
import { CLAIM_PENDING_JOBS, GET_JOB, MARK_JOB_STATE } from '@/providers/outbox-job'
import { GET_NOTIFICATION_RULE_BY_TYPE } from '@/providers/notification'
import {
  FILTER_UNDELIVERED_DEVICES,
  GET_ACTIVE_DEVICES_FOR_USERS,
  GET_NOTIFICATION_CONTENT,
  GET_NOTIFICATION_RECIPIENTS,
  GET_PREFERENCE_MAP_FOR_USERS,
  MARK_DEVICE_DISABLED,
  MARK_NOTIFICATION_DELIVERY,
  UPSERT_NOTIFICATION_DELIVERY,
} from '@/providers/mobile'
import { SEND_PUSH_BATCH } from '@/providers/push'
import { decryptDeviceToken } from '@/utils/device-token'

/*
 * `notification.send` worker (F12).
 *
 * Claims one RUNNING outbox row, resolves the public content, filters recipients
 * by current preference and active tokens, then sends notification+data through
 * FCM. Dedupe is per event/user/device, so an SQS retry never sends twice.
 */

const MAX_ATTEMPTS = 3
const CHUNK = 500
const backoff = (attempts: number) => new Date(Date.now() + 30_000 * 2 ** attempts)

/** Trigger -> preference key, and trigger -> mobile tap type. */
const PREFERENCE_BY_TRIGGER: Record<string, string> = {
  prayer_published: 'daily_prayer',
  announcement_published: 'announcements',
  event_reminder: 'church_events',
  donation_reminder: 'donation_reminder',
}
const TAP_TYPE_BY_TRIGGER: Record<string, string> = {
  prayer_published: 'prayer',
  announcement_published: 'announcement',
  event_reminder: 'event',
}

export type JobOutcome = 'succeeded' | 'failed' | 'requeued' | 'skipped'

export type JobSummary = {
  claimed: number
  succeeded: number
  failed: number
  requeued: number
  skipped: number
}

export const processNotificationSendJob = async (
  jobId: string,
  _requestId: string,
): Promise<JobOutcome> => {
  const job = await GET_JOB({ jobId })
  if (!job || job.state !== 'RUNNING') return 'skipped'

  const payload = job.payload as { type?: string; churchId?: string } | null
  const type = payload?.type
  const churchId = payload?.churchId
  if (!type || !churchId) {
    await MARK_JOB_STATE({ jobId: job.id, state: 'FAILED', errorCode: 'MISSING_PAYLOAD' })
    return 'failed'
  }

  const rule = await GET_NOTIFICATION_RULE_BY_TYPE({ type })
  if (!rule) {
    await MARK_JOB_STATE({ jobId: job.id, state: 'FAILED', errorCode: 'MISSING_RULE' })
    return 'failed'
  }
  if (!rule.enabled) {
    await MARK_JOB_STATE({ jobId: job.id, state: 'SUCCEEDED' })
    return 'succeeded'
  }

  const prefKey = PREFERENCE_BY_TRIGGER[type]
  const tapType = TAP_TYPE_BY_TRIGGER[type]
  if (!prefKey) {
    await MARK_JOB_STATE({ jobId: job.id, state: 'FAILED', errorCode: 'UNSUPPORTED_NOTIFICATION' })
    return 'failed'
  }

  const content = await GET_NOTIFICATION_CONTENT({
    type,
    resourceId: job.resource_id,
    churchId,
  })
  if (!content) {
    await MARK_JOB_STATE({ jobId: job.id, state: 'FAILED', errorCode: 'MISSING_CONTENT' })
    return 'failed'
  }

  const recipients = await GET_NOTIFICATION_RECIPIENTS({ churchId })
  const userIds = recipients.map((r) => r.user_id)
  const prefMap = await GET_PREFERENCE_MAP_FOR_USERS({ userIds })
  const eligible = userIds.filter((id) => prefMap.get(id)?.get(prefKey) !== false)
  const devices = await GET_ACTIVE_DEVICES_FOR_USERS({ userIds: eligible })
  const undelivered = await FILTER_UNDELIVERED_DEVICES({
    eventKey: job.dedupe_key,
    deviceTokenIds: devices.map((d) => d.id),
  })
  const targets = devices.filter((d) => undelivered.has(d.id))
  if (targets.length === 0) {
    await MARK_JOB_STATE({ jobId: job.id, state: 'SUCCEEDED' })
    return 'succeeded'
  }

  const data: Record<string, string> = {
    type: tapType ?? type,
    churchId,
    messageId: job.dedupe_key,
    ...(job.resource_id ? { resourceId: job.resource_id } : {}),
  }

  try {
    let transient = false
    for (let i = 0; i < targets.length; i += CHUNK) {
      const slice = targets.slice(i, i + CHUNK)
      const results = await SEND_PUSH_BATCH(
        slice.map((d) => ({
          token: decryptDeviceToken(d.token_ciphertext),
          title: content.title,
          body: content.body,
          data,
        })),
      )
      for (let j = 0; j < results.length; j += 1) {
        const device = slice[j]
        const result = results[j]
        const delivery = await UPSERT_NOTIFICATION_DELIVERY({
          ruleId: rule.id,
          userId: device.user_id,
          deviceTokenId: device.id,
          eventKey: job.dedupe_key,
        })
        await MARK_NOTIFICATION_DELIVERY({
          id: delivery.id,
          status: result.ok ? 'sent' : 'failed',
        })
        if (result.ok) continue
        if (result.invalidToken) {
          await MARK_DEVICE_DISABLED({ deviceTokenId: device.id })
          continue
        }
        transient = true
      }
    }

    if (transient && job.attempts < MAX_ATTEMPTS) {
      await MARK_JOB_STATE({
        jobId: job.id,
        state: 'PENDING',
        errorCode: 'PUSH_TRANSIENT',
        availableAt: backoff(job.attempts),
      })
      return 'requeued'
    }
    if (transient) {
      await MARK_JOB_STATE({ jobId: job.id, state: 'FAILED', errorCode: 'PUSH_FAILED' })
      return 'failed'
    }
    await MARK_JOB_STATE({ jobId: job.id, state: 'SUCCEEDED' })
    return 'succeeded'
  } catch (err) {
    const errorCode = err instanceof Error && 'code' in err ? String(err.code) : 'PUSH_ERROR'
    if (job.attempts < MAX_ATTEMPTS) {
      await MARK_JOB_STATE({
        jobId: job.id,
        state: 'PENDING',
        errorCode,
        availableAt: backoff(job.attempts),
      })
      return 'requeued'
    }
    await MARK_JOB_STATE({ jobId: job.id, state: 'FAILED', errorCode })
    return 'failed'
  }
}

export const runNotificationSendTick = async ({
  limit = 10,
}: { limit?: number } = {}): Promise<JobSummary> => {
  const summary: JobSummary = { claimed: 0, succeeded: 0, failed: 0, requeued: 0, skipped: 0 }
  const claimed = await CLAIM_PENDING_JOBS({ kind: 'notification.send', limit })
  summary.claimed = claimed.length
  for (const job of claimed) {
    try {
      summary[await processNotificationSendJob(job.id, crypto.randomUUID())]++
    } catch {
      summary.skipped++
      await MARK_JOB_STATE({
        jobId: job.id,
        state: 'PENDING',
        errorCode: 'INTERNAL_JOB_ERROR',
        availableAt: backoff(0),
      }).catch(() => undefined)
    }
  }
  return summary
}
