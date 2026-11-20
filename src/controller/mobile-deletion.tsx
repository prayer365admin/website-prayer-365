import { GeneralError } from '@/utils/general-error'
import { withIdempotency } from '@/utils/idempotency'
import { auditPayload } from '@/utils/audit'
import { isCustomerRole } from '@/utils/customer-role'
import {
  CREATE_DELETION_JOB,
  DISABLE_ALL_DEVICES,
  ENQUEUE_DELETION_FINALIZE,
  GET_DELETION_ELIGIBILITY,
  GET_DELETION_JOB_FOR_USER,
  GET_NEWEST_LOGIN_AT,
  GET_OPEN_DELETION_JOB,
  MARK_USER_DELETION_PENDING,
} from '@/providers/privacy-job'

/*
 * MB-06 — DELETE /api/v1/mobile/me (SPEC §8.4 / §11.2, plan:
 * .claude/spec/mobile/account-deletion/plan.md).
 *
 * ACCEPT only: 202 means "deletion requested", never "deleted". Nothing is erased here; the
 * user is hidden (status deletion_pending), every session is killed (auth_version bump) and
 * the finalize worker is scheduled for the end of the grace window. Customers only.
 */

const num = (raw: string | undefined, fallback: number) => {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1 ? n : fallback
}

const DEFAULT_GRACE_SECONDS = 14 * 24 * 60 * 60
const MIN_PROD_GRACE_SECONDS = 24 * 60 * 60

/**
 * Length of the grace window in SECONDS (one unit, so a local test can use 60). In production a
 * window shorter than a day is ignored: a mistyped `60` must not erase accounts a minute later.
 */
export const getGraceSeconds = () => {
  const seconds = num(process.env.ACCOUNT_DELETION_GRACE_SECONDS, DEFAULT_GRACE_SECONDS)
  return process.env.APP_ENV === 'PROD' && seconds < MIN_PROD_GRACE_SECONDS
    ? DEFAULT_GRACE_SECONDS
    : seconds
}
const getReauthMinutes = () => num(process.env.ACCOUNT_DELETION_REAUTH_MINUTES, 5)

export type DeletionAck = {
  job_id: string
  state: string
  grace_ends_at: string
}

const notAllowed = () =>
  new GeneralError({
    code: 403,
    error: 'FORBIDDEN',
    error_code: 'DELETION_NOT_ALLOWED',
    details: 'Only customer accounts can be deleted from the app.',
  })

const reauthRequired = () =>
  new GeneralError({
    code: 401,
    error: 'Not Authenticated!',
    error_code: 'REAUTH_REQUIRED',
    details: 'Please confirm your password and try again.',
  })

export const requestMyDeletion = async ({
  userId,
  idempotencyKey,
  requestId,
  reason,
}: {
  userId: string
  idempotencyKey?: string
  requestId: string
  /** Optional plain-text reason for leaving; blank counts as none. */
  reason?: string
}): Promise<DeletionAck> => {
  const user = await GET_DELETION_ELIGIBILITY({ userId })
  if (!user || user.status !== 'active') throw reauthRequired()
  // Customers only: no role or the customer role, and no staff footprint of any kind.
  if (!isCustomerRole(user.role) || user._count.roleAssignments > 0 || user._count.pastors > 0) {
    throw notAllowed()
  }

  // Reauthentication proof: the client just re-ran the password login (mobile `reauthenticate`),
  // so the user must have a login this recent. A refreshed old session does not count.
  const loginAt = await GET_NEWEST_LOGIN_AT({ userId })
  if (!loginAt || Date.now() - loginAt.getTime() > getReauthMinutes() * 60 * 1000) {
    throw reauthRequired()
  }

  const { resource_id } = await withIdempotency({
    actorKey: `user:${userId}`,
    operation: 'account.delete',
    key: idempotencyKey ?? '',
    requestBody: {},
    run: async (tx) => {
      // Defensive: a second key while a job is open must not start a second deletion.
      const open = await GET_OPEN_DELETION_JOB({ userId, tx })
      if (open) return open.id

      const graceEndsAt = new Date(Date.now() + getGraceSeconds() * 1000)
      const job = await CREATE_DELETION_JOB({
        userId,
        graceEndsAt,
        reason: reason?.trim() || null,
        tx,
      })
      await MARK_USER_DELETION_PENDING({ userId, tx })
      await DISABLE_ALL_DEVICES({ userId, tx })
      await ENQUEUE_DELETION_FINALIZE({ jobId: job.id, availableAt: graceEndsAt, tx })
      await tx.auditLog.create({
        data: auditPayload({
          actorId: userId,
          action: 'account.delete.accepted',
          resourceType: 'privacy_job',
          resourceId: job.id,
          outcome: 'success',
          requestId,
        }),
      })
      return job.id
    },
  })

  const job = resource_id ? await GET_DELETION_JOB_FOR_USER({ id: resource_id, userId }) : null
  if (!job?.grace_ends_at) {
    throw new GeneralError({
      code: 500,
      error: 'INTERNAL_ERROR',
      error_code: 'INTERNAL_ERROR',
      details: 'Something went wrong',
    })
  }
  return { job_id: job.id, state: job.state, grace_ends_at: job.grace_ends_at.toISOString() }
}
