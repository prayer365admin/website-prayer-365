import crypto from 'node:crypto'
import { CLAIM_PENDING_JOBS, GET_JOB, MARK_JOB_STATE } from '@/providers/outbox-job'
import { GET_NOTIFICATION_RULE_BY_TYPE } from '@/providers/notification'
import { ENQUEUE_MAIL_SEND } from '@/providers/mail-job'
import { LIST_ACTIVE_USERS } from '@/providers/user'
import {
  FILTER_UNDELIVERED_DEVICES,
  GET_ACTIVE_DEVICES_FOR_USERS,
  GET_PREFERENCE_MAP_FOR_USERS,
  MARK_DEVICE_DISABLED,
  MARK_NOTIFICATION_DELIVERY,
  UPSERT_NOTIFICATION_DELIVERY,
} from '@/providers/mobile'
import { SEND_PUSH_BATCH } from '@/providers/push'
import { GET_GENERAL_PRAYER_BY_ID } from '@/providers/general-prayer'
import { SEND_CHUNK } from '@/config/general-prayer'
import { todayInTallinn } from '@/utils/general-prayer-cycle'
import { richTextFirstSentence, richTextToPlainText } from '@/utils/rich-text-plain'
import { decryptDeviceToken } from '@/utils/device-token'
import { logger } from '@/utils/logger'

/*
 * `general_prayer.send` worker (GP-JOB-S-03…08).
 *
 * One job per calendar date. The audience is the whole active user table
 * (D-GP-1) minus `daily_prayer = false` (D-GP-9, missing preference = ON).
 *
 * Resumability (R5): each attempt handles at most SEND_CHUNK users and requeues
 * with a `cursor` in the payload while the audience has more. Every delivery is
 * deduped by the database — `notification_deliveries` per device and the
 * `mail.send` outbox unique key per user — so a resumed or replayed attempt can
 * never send the same user twice.
 */

const MAX_ATTEMPTS = 3
const TRIGGER = 'general_prayer'
const PREFERENCE_KEY = 'daily_prayer'
const EMAIL_TEMPLATE = 'notification-general-prayer'
const PUSH_BATCH = 500
/** Push body cap: one readable line, never an HTML dump. */
const PUSH_BODY_CHARS = 180

const backoff = (attempts: number) => new Date(Date.now() + 30_000 * 2 ** attempts)

export type JobOutcome = 'succeeded' | 'failed' | 'requeued' | 'skipped'

export type JobSummary = {
  claimed: number
  succeeded: number
  failed: number
  requeued: number
  skipped: number
}

/**
 * Mail paragraphs. The mail pipeline escapes every Handlebars value, so the
 * prayer body travels as PLAIN TEXT: sending the stored HTML would print the
 * tags in the mail client. `richTextToPlainText` turns every block end into one
 * newline, so a single newline is the paragraph break here and the template
 * renders one <p> per entry.
 */
export const generalPrayerMailParagraphs = (body: string): string[] =>
  richTextToPlainText(body)
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)

/**
 * Absolute site origin for the mail (CTA button + logo).
 *
 * `BASE_URL` is the configured source. When it is empty the pipeline used to emit
 * RELATIVE urls, which are dead links in every mail client — a mail is rendered
 * outside the app shell, so "relative works in the app" does not apply. Locally it
 * falls back to the dev server; production refuses to send (MISSING_BASE_URL)
 * instead of mailing broken buttons.
 */
export const mailOrigin = (env: Record<string, string | undefined> = process.env): string => {
  const configured = (env.BASE_URL || '').trim().replace(/\/$/, '')
  if (configured) return configured
  if ((env.APP_ENV || '').toUpperCase() === 'PROD') return ''
  return 'http://localhost:3000'
}

/** `2026-11-13` -> `13.11.2026`, the date form the content itself uses. */
export const formatPrayerDate = (dateISO: string): string => {
  const [year, month, day] = dateISO.split('-')
  return `${day}.${month}.${year}`
}

const pushBody = ({ verse, body }: { verse: string | null; body: string }) => {
  const first = verse?.trim() || richTextFirstSentence(body) || richTextToPlainText(body)
  const line = first.replace(/\s+/g, ' ').trim()
  return line.length > PUSH_BODY_CHARS ? `${line.slice(0, PUSH_BODY_CHARS - 1)}…` : line
}

export const processGeneralPrayerSendJob = async (
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
  // Disabled type: stop delivery immediately, but this is not a failure.
  if (!rule.enabled) {
    await MARK_JOB_STATE({ jobId: job.id, state: 'SUCCEEDED' })
    return 'succeeded'
  }
  const pushEnabled = rule.push_enabled
  const emailEnabled = rule.email_enabled
  if (!pushEnabled && !emailEnabled) {
    await MARK_JOB_STATE({ jobId: job.id, state: 'SUCCEEDED' })
    return 'succeeded'
  }

  const payload = (job.payload ?? null) as { date?: string; cursor?: string } | null
  const dateISO = payload?.date ?? todayInTallinn().dateISO
  const cursor = payload?.cursor

  const generalPrayerId = job.resource_id
  const prayer = generalPrayerId ? await GET_GENERAL_PRAYER_BY_ID({ generalPrayerId }) : null
  if (!prayer) {
    await MARK_JOB_STATE({ jobId: job.id, state: 'FAILED', errorCode: 'MISSING_CONTENT' })
    return 'failed'
  }
  if (!prayer.is_active) {
    // Content was retired between the sweep and the send: nothing goes out.
    logger.info('general_prayer_send_skipped_inactive', {
      job_id: job.id,
      general_prayer_id: prayer.id,
      date: dateISO,
    })
    await MARK_JOB_STATE({ jobId: job.id, state: 'SUCCEEDED', errorCode: 'PRAYER_INACTIVE' })
    return 'succeeded'
  }

  const audience = await LIST_ACTIVE_USERS({ cursor, limit: SEND_CHUNK })
  if (audience.length === 0) {
    await MARK_JOB_STATE({ jobId: job.id, state: 'SUCCEEDED' })
    return 'succeeded'
  }

  const userIds = audience.map((user) => user.id)
  const prefMap = await GET_PREFERENCE_MAP_FOR_USERS({ userIds })
  const eligible = audience.filter((user) => prefMap.get(user.id)?.get(PREFERENCE_KEY) !== false)

  const baseUrl = mailOrigin()
  if (emailEnabled && !baseUrl) {
    // No origin means a mail full of relative links; fail loudly, never send junk.
    logger.error('general_prayer_send_missing_base_url', { job_id: job.id, date: dateISO })
    await MARK_JOB_STATE({ jobId: job.id, state: 'FAILED', errorCode: 'MISSING_BASE_URL' })
    return 'failed'
  }
  const ctaLink = `${baseUrl}/prayers/general/${prayer.slug}`

  try {
    if (emailEnabled) {
      // One idempotent enqueue per user per date; the outbox unique key absorbs retries.
      for (const user of eligible) {
        await ENQUEUE_MAIL_SEND({
          dedupeKeySuffix: `${TRIGGER}:${dateISO}:${user.id}`,
          skipDuplicates: true,
          message: {
            from: process.env.MAIL_FROM || 'info@example.com',
            to: user.email,
            subject: prayer.title,
            template_name: EMAIL_TEMPLATE,
            payload: {
              customerName: user.name || user.email,
              date: formatPrayerDate(dateISO),
              title: prayer.title,
              verse: prayer.verse ?? '',
              verseReference: prayer.verse_reference ?? '',
              body: richTextToPlainText(prayer.body),
              bodyParagraphs: generalPrayerMailParagraphs(prayer.body),
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
        dedupeKey: job.dedupe_key,
        userIds: eligible.map((user) => user.id),
        title: prayer.title,
        body: pushBody({ verse: prayer.verse, body: prayer.body }),
        data: { type: TRIGGER, slug: prayer.slug, date: dateISO },
      })
      if (outcome !== 'succeeded') return outcome
    }

    // More audience behind the cursor: hand the rest to the next attempt.
    if (audience.length === SEND_CHUNK) {
      await MARK_JOB_STATE({
        jobId: job.id,
        state: 'PENDING',
        availableAt: new Date(),
        payload: { date: dateISO, cursor: userIds[userIds.length - 1] },
      })
      return 'requeued'
    }

    await MARK_JOB_STATE({ jobId: job.id, state: 'SUCCEEDED' })
    return 'succeeded'
  } catch (err) {
    const errorCode =
      err instanceof Error && 'code' in err ? String(err.code) : 'GENERAL_PRAYER_SEND_ERROR'
    logger.error('general_prayer_send_job_error', {
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

/** FCM leg. Only `succeeded` lets the caller finish; transient failures requeue. */
const sendPushLeg = async ({
  job,
  ruleId,
  dedupeKey,
  userIds,
  title,
  body,
  data,
}: {
  job: { id: string; attempts: number }
  ruleId: string
  dedupeKey: string
  userIds: string[]
  title: string
  body: string
  data: Record<string, string>
}): Promise<JobOutcome> => {
  const devices = userIds.length ? await GET_ACTIVE_DEVICES_FOR_USERS({ userIds }) : []
  const undelivered = await FILTER_UNDELIVERED_DEVICES({
    eventKey: dedupeKey,
    deviceTokenIds: devices.map((device) => device.id),
  })

  // A device whose token cannot even be decrypted can never be delivered to.
  // Disable it (so the audience stops carrying it) and keep the batch moving —
  // one corrupt row must not fail the whole day's send.
  const targets: { device: (typeof devices)[number]; token: string }[] = []
  for (const device of devices) {
    if (!undelivered.has(device.id)) continue
    try {
      targets.push({ device, token: decryptDeviceToken(device.token_ciphertext) })
    } catch {
      const delivery = await UPSERT_NOTIFICATION_DELIVERY({
        ruleId,
        userId: device.user_id,
        deviceTokenId: device.id,
        eventKey: dedupeKey,
      })
      await MARK_NOTIFICATION_DELIVERY({ id: delivery.id, status: 'failed' })
      await MARK_DEVICE_DISABLED({ deviceTokenId: device.id })
      logger.warn('general_prayer_push_token_undecryptable', { job_id: job.id })
    }
  }
  if (targets.length === 0) return 'succeeded'

  let transient = false
  for (let index = 0; index < targets.length; index += PUSH_BATCH) {
    const slice = targets.slice(index, index + PUSH_BATCH)
    const results = await SEND_PUSH_BATCH(
      slice.map((target) => ({
        token: target.token,
        title,
        body,
        data,
      })),
    )
    for (let offset = 0; offset < results.length; offset += 1) {
      const device = slice[offset].device
      const result = results[offset]
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
  logger.error('general_prayer_push_failed', { job_id: job.id })
  await MARK_JOB_STATE({ jobId: job.id, state: 'FAILED', errorCode: 'PUSH_FAILED' })
  return 'failed'
}

export const runGeneralPrayerSendTick = async ({
  limit = 10,
}: { limit?: number } = {}): Promise<JobSummary> => {
  const summary: JobSummary = { claimed: 0, succeeded: 0, failed: 0, requeued: 0, skipped: 0 }
  const claimed = await CLAIM_PENDING_JOBS({ kind: 'general_prayer.send', limit })
  summary.claimed = claimed.length
  for (const job of claimed) {
    try {
      summary[await processGeneralPrayerSendJob(job.id, crypto.randomUUID())]++
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
