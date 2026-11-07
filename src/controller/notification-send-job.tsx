import crypto from 'node:crypto'
import { CLAIM_PENDING_JOBS, GET_JOB, MARK_JOB_STATE } from '@/providers/outbox-job'
import { GET_NOTIFICATION_RULE_BY_TYPE } from '@/providers/notification'
import { ENQUEUE_MAIL_SEND } from '@/providers/mail-job'
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
import { logger } from '@/utils/logger'

/*
 * `notification.send` worker (F12).
 *
 * Claims one RUNNING outbox row, resolves the public content, filters recipients
 * by current preference, then delivers on the channels the rule enables:
 *   - push: notification+data through FCM, deduped per event/user/device, so an
 *     SQS retry never sends twice;
 *   - email: one `mail.send` outbox row per recipient, deduped by the outbox
 *     unique key, so the existing SQS mail pipeline owns delivery and retries.
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
/** Trigger -> Handlebars template under `public/templates/mail`. */
const EMAIL_TEMPLATE_BY_TRIGGER: Record<string, string> = {
  prayer_published: 'notification-prayer',
  announcement_published: 'notification-announcement',
  event_reminder: 'notification-event',
  donation_reminder: 'notification-donation',
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
  const eligible = new Set(userIds.filter((id) => prefMap.get(id)?.get(prefKey) !== false))

  const pushEnabled = rule.push_enabled
  const emailEnabled = rule.email_enabled
  if (!pushEnabled && !emailEnabled) {
    await MARK_JOB_STATE({ jobId: job.id, state: 'SUCCEEDED' })
    return 'succeeded'
  }

  try {
    // Email first: it is a single idempotent enqueue per recipient, so a push
    // retry cannot lose it and cannot duplicate it (outbox unique key).
    if (emailEnabled) {
      const template_name = EMAIL_TEMPLATE_BY_TRIGGER[type]
      if (!template_name) {
        await MARK_JOB_STATE({
          jobId: job.id,
          state: 'FAILED',
          errorCode: 'UNSUPPORTED_NOTIFICATION',
        })
        return 'failed'
      }
      // Email CTA points at the public church page (W08); BASE_URL is the site
      // origin the mail pipeline already uses as its template host.
      const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '')
      const ctaLink = `${baseUrl}/churches/${content.churchSlug}`

      for (const recipient of recipients) {
        if (!eligible.has(recipient.user_id)) continue
        await ENQUEUE_MAIL_SEND({
          // One mail per event per user; the outbox unique key absorbs retries.
          dedupeKeySuffix: `notification:${job.dedupe_key}:${recipient.user_id}`,
          skipDuplicates: true,
          message: {
            from: process.env.MAIL_FROM || 'info@example.com',
            to: recipient.user.email,
            subject: content.title,
            template_name,
            payload: {
              customerName: recipient.user.name || recipient.user.email,
              churchName: content.churchName,
              body: content.body,
              ctaLink,
            },
            baseUrl,
          },
        })
      }
    }

    if (pushEnabled) {
      const outcome = await sendPushLeg({
        job,
        ruleId: rule.id,
        churchId,
        dedupeKey: job.dedupe_key,
        userIds: Array.from(eligible),
        content,
        data: {
          type: tapType ?? type,
          churchId,
          messageId: job.dedupe_key,
          ...(job.resource_id ? { resourceId: job.resource_id } : {}),
        },
      })
      if (outcome !== 'succeeded') return outcome
    }

    await MARK_JOB_STATE({ jobId: job.id, state: 'SUCCEEDED' })
    return 'succeeded'
  } catch (err) {
    const errorCode =
      err instanceof Error && 'code' in err ? String(err.code) : 'NOTIFICATION_ERROR'
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

/**
 * FCM leg. Returns the job outcome the caller should propagate: only
 * `succeeded` lets the caller finish the job; transient failures requeue and a
 * spent retry budget fails.
 */
const sendPushLeg = async ({
  job,
  ruleId,
  churchId,
  dedupeKey,
  userIds,
  content,
  data,
}: {
  job: { id: string; attempts: number }
  ruleId: string
  churchId: string
  dedupeKey: string
  userIds: string[]
  content: { title: string; body: string }
  data: Record<string, string>
}): Promise<JobOutcome> => {
  const devices = userIds.length ? await GET_ACTIVE_DEVICES_FOR_USERS({ userIds }) : []
  const undelivered = await FILTER_UNDELIVERED_DEVICES({
    eventKey: dedupeKey,
    deviceTokenIds: devices.map((d) => d.id),
  })
  const targets = devices.filter((d) => undelivered.has(d.id))
  if (targets.length === 0) return 'succeeded'

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
        ruleId,
        userId: device.user_id,
        deviceTokenId: device.id,
        eventKey: dedupeKey,
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

  if (!transient) return 'succeeded'
  if (job.attempts < MAX_ATTEMPTS) {
    await MARK_JOB_STATE({
      jobId: job.id,
      state: 'PENDING',
      errorCode: 'PUSH_TRANSIENT',
      availableAt: backoff(job.attempts),
    })
    return 'requeued'
  }
  logger.error('notification_push_failed', { job_id: job.id, church_id: churchId })
  await MARK_JOB_STATE({ jobId: job.id, state: 'FAILED', errorCode: 'PUSH_FAILED' })
  return 'failed'
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
