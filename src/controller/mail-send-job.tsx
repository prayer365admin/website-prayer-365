import crypto from 'node:crypto'
import sendMail from '@/controller/mail'
import type { MailSendRequest } from '@/models/send-mail'
import { CLAIM_PENDING_JOBS, GET_JOB, MARK_JOB_STATE } from '@/providers/outbox-job'
import { GeneralError } from '@/utils/general-error'
import { logger } from '@/utils/logger'

const MAX_ATTEMPTS = 3
const backoff = (attempts: number) => new Date(Date.now() + 30_000 * 2 ** attempts)

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Unset/invalid/negative MAIL_RATE_LIMIT_MS means no delay. */
const mailRateLimitMs = () => {
  const raw = Number(process.env.MAIL_RATE_LIMIT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : 0
}

export type JobOutcome = 'succeeded' | 'failed' | 'requeued' | 'skipped'

export type JobSummary = {
  claimed: number
  succeeded: number
  failed: number
  requeued: number
  skipped: number
}

export const processMailSendJob = async (
  jobId: string,
  _requestId: string,
): Promise<JobOutcome> => {
  const job = await GET_JOB({ jobId })
  if (!job || job.state !== 'RUNNING') return 'skipped'

  // SAFETY: Prisma JSON payload is validated against MailSendRequest below
  const payload = job.payload as MailSendRequest | null
  if (
    !payload ||
    !payload.from ||
    !payload.to ||
    !payload.subject ||
    !payload.template_name ||
    !payload.payload
  ) {
    await MARK_JOB_STATE({ jobId: job.id, state: 'FAILED', errorCode: 'MISSING_PAYLOAD' })
    return 'failed'
  }

  const ms = mailRateLimitMs()
  if (ms > 0) await sleep(ms)

  try {
    await sendMail({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      template_name: payload.template_name,
      payload: payload.payload,
      baseUrl: payload.baseUrl,
      host: payload.host,
    })
    await MARK_JOB_STATE({ jobId: job.id, state: 'SUCCEEDED' })
    return 'succeeded'
  } catch (err: unknown) {
    const isPermanent = err instanceof GeneralError && err.code === 404

    const errorCode =
      err instanceof GeneralError
        ? err.error_code
        : err instanceof Error && 'code' in err
          ? String(err.code)
          : 'INTERNAL_JOB_ERROR'

    // A nodemailer SES failure is tagged `code: 'ESES'` ("AWS SES transport error"),
    // which hides the reason: the name/message carry it (MessageRejected,
    // AccessDenied, invalid FromEmailAddress...). Without this line a stuck job shows
    // only "err=ESES" in the database and nothing useful in CloudWatch.
    // `error_message`, not `message`: the logger redacts a field named `message`.
    logger.error('mail_send_job_error', {
      job_id: job.id,
      error_code: errorCode,
      error_name: err instanceof Error ? err.name : typeof err,
      error_message: (err instanceof Error ? err.message : String(err)).slice(0, 300),
    })

    if (isPermanent || job.attempts >= MAX_ATTEMPTS) {
      await MARK_JOB_STATE({ jobId: job.id, state: 'FAILED', errorCode })
      return 'failed'
    }

    await MARK_JOB_STATE({
      jobId: job.id,
      state: 'PENDING',
      errorCode,
      availableAt: backoff(job.attempts),
    })
    return 'requeued'
  }
}

export const runMailSendTick = async ({
  limit = 10,
}: { limit?: number } = {}): Promise<JobSummary> => {
  const summary: JobSummary = {
    claimed: 0,
    succeeded: 0,
    failed: 0,
    requeued: 0,
    skipped: 0,
  }
  const claimed = await CLAIM_PENDING_JOBS({ kind: 'mail.send', limit })
  summary.claimed = claimed.length
  for (const job of claimed) {
    try {
      summary[await processMailSendJob(job.id, crypto.randomUUID())]++
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
