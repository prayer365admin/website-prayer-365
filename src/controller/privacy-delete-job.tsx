import crypto from 'node:crypto'
import { STRIPE, isStripeEnabled } from '@/providers/stripe'
import { CLAIM_PENDING_JOBS, GET_JOB, MARK_JOB_STATE } from '@/providers/outbox-job'
import {
  CLAIM_PRIVACY_JOB,
  SOFT_DELETE_USER,
  GET_ERASURE_CONTEXT,
  GET_PRIVACY_JOB,
  MARK_SUBSCRIPTION_CANCELED,
  SET_PRIVACY_JOB_STATE,
} from '@/providers/privacy-delete'
import { GeneralError } from '@/utils/general-error'
import { logger } from '@/utils/logger'

/*
 * privacy.delete finalize job (MB-06 phase 2, plan:
 * .claude/spec/mobile/account-deletion/plan.md). Runs at the end of the grace window.
 *
 * Order matters: stop billing first (Stripe, safe to repeat), then ONE database transaction that
 * SOFT-deletes the user (status inactive + deleted_at, sessions revoked). No related data is
 * deleted or rewritten. A failure anywhere re-queues the whole job; a job that already finished
 * (or was cancelled by the user signing in) is a no-op.
 */

const MAX_ATTEMPTS = 5
const backoff = (attempts: number) => new Date(Date.now() + 60_000 * 2 ** attempts)

export type JobOutcome = 'succeeded' | 'failed' | 'requeued' | 'skipped'
export type JobSummary = Record<'claimed' | JobOutcome, number>

const isAlreadyGone = (err: unknown) =>
  (err as { code?: string } | null)?.code === 'resource_missing'

const errorCodeOf = (err: unknown) =>
  err instanceof GeneralError
    ? err.error_code
    : err instanceof Error && 'code' in err
      ? String((err as { code: unknown }).code)
      : 'INTERNAL_JOB_ERROR'

export const processPrivacyDeleteJob = async (
  jobId: string,
  requestId: string,
): Promise<JobOutcome> => {
  const outbox = await GET_JOB({ jobId })
  if (!outbox || outbox.state !== 'RUNNING') return 'skipped'

  const job = outbox.resource_id ? await GET_PRIVACY_JOB({ id: outbox.resource_id }) : null
  if (!job) {
    await MARK_JOB_STATE({ jobId, state: 'FAILED', errorCode: 'MISSING_PRIVACY_JOB' })
    return 'failed'
  }
  // Finished or cancelled (user signed in during grace): nothing to do.
  if (job.state === 'COMPLETED' || job.state === 'CANCELLED') {
    await MARK_JOB_STATE({ jobId, state: 'SUCCEEDED' })
    return 'skipped'
  }
  // Dispatched early (clock skew, manual run): wait for the end of grace.
  if (job.grace_ends_at && job.grace_ends_at.getTime() > Date.now()) {
    await MARK_JOB_STATE({ jobId, state: 'PENDING', availableAt: job.grace_ends_at })
    return 'requeued'
  }

  try {
    const ctx = await GET_ERASURE_CONTEXT({ userId: job.user_id })
    if (!ctx || ctx.status !== 'deletion_pending') {
      // The account is not pending deletion any more: never soft-delete it.
      await SET_PRIVACY_JOB_STATE({ id: job.id, state: 'CANCELLED' })
      await MARK_JOB_STATE({ jobId, state: 'SUCCEEDED' })
      return 'skipped'
    }
    // From here the user can no longer cancel; if they beat us to it, stop.
    if (!(await CLAIM_PRIVACY_JOB({ id: job.id }))) {
      await MARK_JOB_STATE({ jobId, state: 'SUCCEEDED' })
      return 'skipped'
    }

    // 1. Stop billing. Never delete while a charge could still happen.
    for (const sub of ctx.donationSubscriptions) {
      if (!isStripeEnabled()) {
        throw new GeneralError({
          code: 500,
          error: 'INTERNAL_ERROR',
          error_code: 'STRIPE_DISABLED',
          details: 'Active subscription but Stripe is disabled.',
        })
      }
      try {
        await STRIPE.cancelSubscription(sub.provider_subscription_id)
      } catch (err) {
        if (!isAlreadyGone(err)) throw err
      }
      await MARK_SUBSCRIPTION_CANCELED({ providerSubscriptionId: sub.provider_subscription_id })
    }

    // 2. Soft-delete, atomically. Every related row stays as it is.
    await SOFT_DELETE_USER({ userId: job.user_id, jobId: job.id, requestId })
    await MARK_JOB_STATE({ jobId, state: 'SUCCEEDED' })
    return 'succeeded'
  } catch (err) {
    const errorCode = errorCodeOf(err)
    // Never log the user's data: ids and codes only.
    logger.error('privacy_delete_job_error', {
      job_id: jobId,
      privacy_job_id: job.id,
      error_code: errorCode,
      error_name: err instanceof Error ? err.name : typeof err,
    })
    if (outbox.attempts >= MAX_ATTEMPTS) {
      await SET_PRIVACY_JOB_STATE({ id: job.id, state: 'FAILED' })
      await MARK_JOB_STATE({ jobId, state: 'FAILED', errorCode })
      return 'failed'
    }
    await MARK_JOB_STATE({
      jobId,
      state: 'PENDING',
      errorCode,
      availableAt: backoff(outbox.attempts),
    })
    return 'requeued'
  }
}

export const runPrivacyDeleteTick = async ({
  limit = 5,
}: { limit?: number } = {}): Promise<JobSummary> => {
  const summary: JobSummary = { claimed: 0, succeeded: 0, failed: 0, requeued: 0, skipped: 0 }
  const claimed = await CLAIM_PENDING_JOBS({ kind: 'privacy.delete', limit })
  summary.claimed = claimed.length
  for (const job of claimed) {
    try {
      summary[await processPrivacyDeleteJob(job.id, crypto.randomUUID())]++
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
