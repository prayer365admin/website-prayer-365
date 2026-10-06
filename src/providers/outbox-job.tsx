import { db } from '@/utils/db-connection'

/*
 * Outbox job adapter (PR-07). Minimal claim/mark surface reused by every
 * worker (audio.generate now; prayer.publish, voice.register later). The
 * controller decides business rules; this file only moves job rows.
 *
 * Claiming: rows become claimable when PENDING and available_at passed, or
 * when RUNNING past lease_until (crashed worker recovery — without the
 * lease-expiry branch a claimed-then-crashed row stays RUNNING forever and
 * its resource hangs in the in-flight state). A conditional updateMany is the
 * claim: losing the race (count 0) skips the row.
 */

export interface ClaimedJob {
  id: string
  attempts: number
  resource_id: string | null
  payload: unknown
}

export const CLAIM_PENDING_JOBS = async ({
  kind,
  limit = 5,
  now = new Date(),
  leaseSeconds = 300,
}: {
  kind: string
  limit?: number
  now?: Date
  leaseSeconds?: number
}): Promise<ClaimedJob[]> => {
  const rows = await db.outboxJob.findMany({
    where: {
      kind,
      available_at: { lte: now },
      OR: [{ state: 'PENDING' }, { state: 'RUNNING', lease_until: { lt: now } }],
    },
    orderBy: { available_at: 'asc' },
    take: limit,
  })
  const claimed: ClaimedJob[] = []
  for (const row of rows) {
    const lease = await db.outboxJob.updateMany({
      where: { id: row.id, state: row.state },
      data: {
        state: 'RUNNING',
        attempts: { increment: 1 },
        lease_until: new Date(now.getTime() + leaseSeconds * 1000),
      },
    })
    if (lease.count === 1) {
      claimed.push({
        id: row.id,
        attempts: row.attempts + 1,
        resource_id: row.resource_id,
        payload: row.payload,
      })
    }
  }
  return claimed
}

export const GET_JOB = ({ jobId }: { jobId: string }) =>
  db.outboxJob.findUnique({ where: { id: jobId } })

export type OutboxTerminalState = 'SUCCEEDED' | 'FAILED' | 'PENDING'

/** Terminal/requeue transition. Success clears a stale error code from earlier attempts. */
export const MARK_JOB_STATE = ({
  jobId,
  state,
  errorCode,
  availableAt,
}: {
  jobId: string
  state: OutboxTerminalState
  errorCode?: string
  availableAt?: Date
}) =>
  db.outboxJob.update({
    where: { id: jobId },
    data: {
      state,
      ...(errorCode ? { last_error_code: errorCode } : {}),
      ...(state === 'PENDING' && availableAt ? { available_at: availableAt } : {}),
      // Never called with RUNNING (claiming sets the lease via updateMany):
      // terminal + requeue states own no lease.
      lease_until: null,
      ...(state === 'SUCCEEDED' && !errorCode ? { last_error_code: null } : {}),
    },
  })
