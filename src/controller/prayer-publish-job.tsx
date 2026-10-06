import crypto from 'node:crypto'
import { CLAIM_PENDING_JOBS, GET_JOB, MARK_JOB_STATE } from '@/providers/outbox-job'
import {
  GET_PRAYER_FOR_PUBLISH_JOB,
  PUBLISH_PRAYER_BY_JOB,
  GET_VERSION_APPROVAL,
  SCAN_DUE_SCHEDULED_PRAYERS,
  ENQUEUE_DUE_PRAYER_PUBLISH,
} from '@/providers/prayer'
import { ENQUEUE_NOTIFICATION } from '@/providers/notification'

const MAX_ATTEMPTS_RAW = Number(process.env.PRAYER_PUBLISH_MAX_ATTEMPTS ?? 3)
const MAX_ATTEMPTS =
  Number.isFinite(MAX_ATTEMPTS_RAW) && MAX_ATTEMPTS_RAW >= 1 ? MAX_ATTEMPTS_RAW : 3
const backoff = (attempts: number) => new Date(Date.now() + 30_000 * 2 ** attempts)
type JobOutcome = 'succeeded' | 'failed' | 'requeued' | 'skipped'

const requeueOrFail = async (
  job: { id: string; attempts: number },
  errorCode: string,
): Promise<JobOutcome> => {
  if (job.attempts >= MAX_ATTEMPTS) {
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

export const processPrayerPublishJob = async (
  jobId: string,
  requestId: string,
): Promise<JobOutcome> => {
  const job = await GET_JOB({ jobId })
  if (!job || job.state !== 'RUNNING' || !job.resource_id) return 'skipped'

  if (!job.payload) {
    await MARK_JOB_STATE({ jobId, state: 'FAILED', errorCode: 'MISSING_PAYLOAD' })
    return 'failed'
  }

  const payload = job.payload as { prayerVersionId: string; churchId: string }
  const prayer = await GET_PRAYER_FOR_PUBLISH_JOB({ prayerId: job.resource_id })

  if (!prayer) {
    await MARK_JOB_STATE({ jobId, state: 'SUCCEEDED' })
    return 'succeeded'
  }

  if (prayer.published_version_id === payload.prayerVersionId) {
    await MARK_JOB_STATE({ jobId, state: 'SUCCEEDED' })
    return 'succeeded'
  }

  try {
    if (prayer.church.status === 'SUSPENDED') {
      await MARK_JOB_STATE({ jobId, state: 'FAILED', errorCode: 'CHURCH_NOT_APPROVED' })
      return 'failed'
    }

    if (prayer.scheduled_version_id && prayer.scheduled_version_id !== payload.prayerVersionId) {
      await MARK_JOB_STATE({ jobId, state: 'FAILED', errorCode: 'SUPERSEDED_SCHEDULE' })
      return 'failed'
    }

    const versionApproval = await GET_VERSION_APPROVAL({
      prayerVersionId: payload.prayerVersionId,
    })
    if (!versionApproval?.approved_at) {
      await MARK_JOB_STATE({ jobId, state: 'FAILED', errorCode: 'VERSION_NOT_APPROVED' })
      return 'failed'
    }

    const published = await PUBLISH_PRAYER_BY_JOB({
      prayerId: prayer.id,
      prayerVersionId: payload.prayerVersionId,
      churchId: payload.churchId,
      expectedVersion: prayer.version,
      requestId,
    })

    if (published.count === 0) {
      return await requeueOrFail(job, 'CONCURRENCY_CONFLICT')
    }

    try {
      await ENQUEUE_NOTIFICATION({
        type: 'prayer_published',
        resourceId: prayer.id,
        churchId: payload.churchId,
        dedupeKeySuffix: `${prayer.id}:${payload.prayerVersionId}`,
      })
    } catch {
      // Not blocking the job itself.
      // Error is caught. Next step succeeds job.
    }

    await MARK_JOB_STATE({ jobId, state: 'SUCCEEDED' })
    return 'succeeded'
  } catch {
    return requeueOrFail(job, 'INTERNAL_JOB_ERROR')
  }
}

export const scanDueScheduledPrayers = async (): Promise<{ enqueued: number }> => {
  const due = await SCAN_DUE_SCHEDULED_PRAYERS()
  let enqueued = 0
  for (const prayer of due) {
    try {
      await ENQUEUE_DUE_PRAYER_PUBLISH({
        prayerId: prayer.id,
        prayerVersionId: prayer.scheduled_version_id,
        churchId: prayer.church_id,
        availableAt: prayer.scheduled_at,
      })
      enqueued++
    } catch {
      // individual failure logged, not blocking
    }
  }
  return { enqueued }
}

export const runPrayerPublishTick = async ({ limit = 5 }: { limit?: number } = {}) => {
  const scan = await scanDueScheduledPrayers()
  const claimed = await CLAIM_PENDING_JOBS({ kind: 'prayer.publish', limit })
  const summary = {
    scanned: scan.enqueued,
    claimed: claimed.length,
    succeeded: 0,
    failed: 0,
    requeued: 0,
    skipped: 0,
  }
  for (const job of claimed) {
    try {
      const outcome = await processPrayerPublishJob(job.id, crypto.randomUUID())
      summary[outcome]++
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
