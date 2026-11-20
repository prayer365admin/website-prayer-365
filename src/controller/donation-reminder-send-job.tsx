import crypto from 'node:crypto'
import { CLAIM_PENDING_JOBS, GET_JOB, MARK_JOB_STATE } from '@/providers/outbox-job'
import { GET_NOTIFICATION_RULE_BY_TYPE } from '@/providers/notification'
import { ENQUEUE_MAIL_SEND } from '@/providers/mail-job'
import { LIST_ACTIVE_CUSTOMERS } from '@/providers/user'
import {
  GET_CHURCH_NAME,
  GET_MAIN_CHURCH_IDS_FOR_USERS,
  GET_PLATFORM_CHURCH_ID,
  GET_PREFERENCE_MAP_FOR_USERS,
} from '@/providers/mobile'
import { mailOrigin, sendPushLeg } from '@/controller/general-prayer-send-job'
import type { JobOutcome, JobSummary } from '@/controller/general-prayer-send-job'
import { SEND_CHUNK } from '@/config/general-prayer'
import { PLATFORM_CHURCH_NAME, PLATFORM_GIVE_PATH } from '@/config/platform-church'
import { logger } from '@/utils/logger'

/*
 * `donation_reminder.send` worker.
 *
 * One job per recurrence period (weekly ISO week / calendar month, see
 * `donationPeriodKey`). The audience is ALL active CUSTOMERS (no church needed)
 * minus `donation_reminder = false` (missing preference = ON). Staff never get it.
 *
 * Same resumable shape as the daily prayer: each attempt handles at most SEND_CHUNK
 * users and requeues with a `cursor` while the audience has more. Deliveries are
 * deduped by the database (`notification_deliveries` per device, `mail.send` unique
 * key per user), so a replayed attempt never sends twice.
 */

const MAX_ATTEMPTS = 3
const TRIGGER = 'donation_reminder'
const PREFERENCE_KEY = 'donation_reminder'
const EMAIL_TEMPLATE = 'notification-donation'
const TITLE = 'A gentle reminder to give'
/** `recipient` is the user's main church (or the platform church), never an arbitrary string. */
const body = (recipient: string) =>
  `Support ${recipient} with a one-time gift or a monthly offering. God bless you.`

const backoff = (attempts: number) => new Date(Date.now() + 30_000 * 2 ** attempts)

export const processDonationReminderSendJob = async (
  jobId: string,
  _requestId: string,
): Promise<JobOutcome> => {
  const job = await GET_JOB({ jobId })
  if (!job || job.state !== 'RUNNING') return 'skipped'

  const rule = await GET_NOTIFICATION_RULE_BY_TYPE({ type: TRIGGER })
  if (!rule) {
    await MARK_JOB_STATE({ jobId: job.id, state: 'FAILED', errorCode: 'MISSING_RULE' })
    return 'failed'
  }
  if (!rule.enabled || (!rule.push_enabled && !rule.email_enabled)) {
    await MARK_JOB_STATE({ jobId: job.id, state: 'SUCCEEDED' })
    return 'succeeded'
  }

  const payload = (job.payload ?? null) as { period?: string; cursor?: string } | null
  const cursor = payload?.cursor

  const audience = await LIST_ACTIVE_CUSTOMERS({ cursor, limit: SEND_CHUNK })
  if (audience.length === 0) {
    await MARK_JOB_STATE({ jobId: job.id, state: 'SUCCEEDED' })
    return 'succeeded'
  }

  const userIds = audience.map((user) => user.id)
  const prefMap = await GET_PREFERENCE_MAP_FOR_USERS({ userIds })
  const eligible = audience.filter((user) => prefMap.get(user.id)?.get(PREFERENCE_KEY) !== false)

  const baseUrl = mailOrigin()
  if (rule.email_enabled && !baseUrl) {
    logger.error('donation_reminder_send_missing_base_url', { job_id: job.id })
    await MARK_JOB_STATE({ jobId: job.id, state: 'FAILED', errorCode: 'MISSING_BASE_URL' })
    return 'failed'
  }

  try {
    // One church per user, used by BOTH legs: their main church, else the platform church. The
    // push deep-links to it and both legs name it in the text.
    const mainChurch = eligible.length
      ? await GET_MAIN_CHURCH_IDS_FOR_USERS({ userIds: eligible.map((u) => u.id) })
      : new Map<string, string>()
    const platformChurchId = await GET_PLATFORM_CHURCH_ID()
    const churchOf = (userId: string) => mainChurch.get(userId) ?? platformChurchId ?? ''
    const nameCache = new Map<string, string>()
    const nameOf = async (churchId: string) => {
      if (!churchId) return PLATFORM_CHURCH_NAME
      if (!nameCache.has(churchId)) {
        nameCache.set(churchId, (await GET_CHURCH_NAME({ churchId })) ?? PLATFORM_CHURCH_NAME)
      }
      return nameCache.get(churchId) as string
    }

    if (rule.email_enabled) {
      for (const user of eligible) {
        const churchName = await nameOf(churchOf(user.id))
        await ENQUEUE_MAIL_SEND({
          dedupeKeySuffix: `${TRIGGER}:${payload?.period ?? 'period'}:${user.id}`,
          skipDuplicates: true,
          message: {
            from: process.env.MAIL_FROM || 'info@example.com',
            to: user.email,
            subject: TITLE,
            template_name: EMAIL_TEMPLATE,
            payload: {
              customerName: user.name || user.email,
              churchName,
              body: body(churchName),
              ctaLink: `${baseUrl}${PLATFORM_GIVE_PATH}`,
            },
            baseUrl,
          },
        })
      }
    }

    if (rule.push_enabled && eligible.length > 0) {
      // The tap opens a church's donate page, so each push carries that church (grouped fan-out).
      const byChurch = new Map<string, string[]>()
      for (const user of eligible) {
        const churchId = churchOf(user.id)
        byChurch.set(churchId, [...(byChurch.get(churchId) ?? []), user.id])
      }
      for (const [churchId, ids] of Array.from(byChurch.entries())) {
        const outcome = await sendPushLeg({
          job,
          ruleId: rule.id,
          dedupeKey: job.dedupe_key,
          userIds: ids,
          title: TITLE,
          body: body(await nameOf(churchId)),
          data: { type: 'donation', messageId: job.dedupe_key, ...(churchId ? { churchId } : {}) },
        })
        if (outcome !== 'succeeded') return outcome
      }
    }

    if (audience.length === SEND_CHUNK) {
      await MARK_JOB_STATE({
        jobId: job.id,
        state: 'PENDING',
        availableAt: new Date(),
        payload: { period: payload?.period, cursor: userIds[userIds.length - 1] },
      })
      return 'requeued'
    }

    await MARK_JOB_STATE({ jobId: job.id, state: 'SUCCEEDED' })
    return 'succeeded'
  } catch (err) {
    const errorCode =
      err instanceof Error && 'code' in err ? String(err.code) : 'DONATION_REMINDER_SEND_ERROR'
    logger.error('donation_reminder_send_job_error', {
      job_id: job.id,
      error_code: errorCode,
      error_message: err instanceof Error ? err.message : String(err),
    })
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

export const runDonationReminderSendTick = async ({
  limit = 10,
}: { limit?: number } = {}): Promise<JobSummary> => {
  const summary: JobSummary = { claimed: 0, succeeded: 0, failed: 0, requeued: 0, skipped: 0 }
  const claimed = await CLAIM_PENDING_JOBS({ kind: 'donation_reminder.send', limit })
  summary.claimed = claimed.length
  for (const job of claimed) {
    try {
      summary[await processDonationReminderSendJob(job.id, crypto.randomUUID())]++
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
