import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'

/*
 * Privacy job adapter (MB-06 account deletion). Raw DB only: the controller owns
 * every business rule (eligibility, grace window, idempotency).
 */

export const DELETION_KIND = 'account_delete'
/** A job that still blocks a second request: accepted or being finalized. */
export const OPEN_DELETION_STATES = ['ACCEPTED', 'RUNNING']

/** The user's open deletion job, if any (at most one by construction). */
export const GET_OPEN_DELETION_JOB = async ({
  userId,
  tx = db,
}: {
  userId: string
  tx?: Prisma.TransactionClient
}) =>
  tx.privacyJob.findFirst({
    where: { user_id: userId, kind: DELETION_KIND, state: { in: OPEN_DELETION_STATES } },
    orderBy: { requested_at: 'desc' },
  })

/** Everything the "customer only" guard needs, in one read. */
export const GET_DELETION_ELIGIBILITY = async ({ userId }: { userId: string }) =>
  db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
      role: { select: { name: true } },
      _count: {
        select: {
          roleAssignments: { where: { revoked_at: null } },
          pastors: { where: { deleted_at: null } },
        },
      },
    },
  })

/**
 * Time of the user's most recent password login that still has a live mobile session. A login
 * is the FIRST token of a session family; refresh rotation adds newer rows to the same family,
 * so we take each family's earliest row, then the latest of those. A plain "newest token" would
 * let a refresh pass as a login.
 */
export const GET_NEWEST_LOGIN_AT = async ({ userId }: { userId: string }): Promise<Date | null> => {
  const families = await db.authToken.groupBy({
    by: ['family_id'],
    where: {
      user_id: userId,
      type: 'MOBILE_REFRESH',
      revoked_at: null,
      family_id: { not: null },
    },
    _min: { created_at: true },
  })
  const times = families.flatMap((f) => (f._min.created_at ? [f._min.created_at.getTime()] : []))
  return times.length ? new Date(Math.max(...times)) : null
}

export const CREATE_DELETION_JOB = async ({
  userId,
  graceEndsAt,
  reason,
  tx,
}: {
  userId: string
  graceEndsAt: Date
  reason?: string | null
  tx: Prisma.TransactionClient
}) =>
  tx.privacyJob.create({
    data: {
      user_id: userId,
      kind: DELETION_KIND,
      state: 'ACCEPTED',
      grace_ends_at: graceEndsAt,
      reason: reason ?? null,
    },
  })

/** Hide the user and kill every session: status flag + auth_version bump. */
export const MARK_USER_DELETION_PENDING = async ({
  userId,
  tx,
}: {
  userId: string
  tx: Prisma.TransactionClient
}) =>
  tx.user.update({
    where: { id: userId },
    data: { status: 'deletion_pending', auth_version: { increment: 1 } },
    select: { id: true },
  })

export const DISABLE_ALL_DEVICES = async ({
  userId,
  tx,
}: {
  userId: string
  tx: Prisma.TransactionClient
}) =>
  tx.deviceToken.updateMany({
    where: { user_id: userId, disabled_at: null },
    data: { disabled_at: new Date() },
  })

/** Schedules the finalize worker for the end of grace. One job per privacy job (dedupe key). */
export const ENQUEUE_DELETION_FINALIZE = async ({
  jobId,
  availableAt,
  tx,
}: {
  jobId: string
  availableAt: Date
  tx: Prisma.TransactionClient
}) =>
  tx.outboxJob.create({
    data: {
      kind: 'privacy.delete',
      dedupe_key: `privacy.delete:${jobId}`,
      resource_id: jobId,
      available_at: availableAt,
    },
  })

export const GET_DELETION_JOB_FOR_USER = async ({ id, userId }: { id: string; userId: string }) =>
  db.privacyJob.findFirst({ where: { id, user_id: userId, kind: DELETION_KIND } })

/**
 * Cancel a pending deletion because the user signed in during grace. Succeeds ONLY while the job
 * is still ACCEPTED: once the finalize worker has claimed it (RUNNING) the erase may be under way
 * and the account must stay refused. Job and user flip together, or neither does.
 */
export const CANCEL_ACCOUNT_DELETION = async ({ userId }: { userId: string }): Promise<boolean> =>
  db.$transaction(async (tx) => {
    const cancelled = await tx.privacyJob.updateMany({
      where: { user_id: userId, kind: DELETION_KIND, state: 'ACCEPTED' },
      data: { state: 'CANCELLED', cancelled_at: new Date() },
    })
    if (cancelled.count === 0) return false
    await tx.user.update({
      where: { id: userId },
      data: { status: 'active' },
      select: { id: true },
    })
    return true
  })
