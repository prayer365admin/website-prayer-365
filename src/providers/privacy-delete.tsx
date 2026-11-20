import { db } from '@/utils/db-connection'
import { dbTransaction } from '@/utils/db-transaction'
import { auditPayload } from '@/utils/audit'

/*
 * Account-deletion finalize adapter (MB-06 phase 2). Raw DB only; the job controller owns
 * the order and the retry policy. Every function is safe to run twice.
 *
 * Finalizing is a SOFT delete: the user row is flagged (status inactive + deleted_at) and every
 * related row stays intact. Hiding the customer is the job of the dashboard read paths
 * (CUSTOMER_ACCOUNT_FILTER, requestVisibilityWhere, GET_CUSTOMERS), not of deleting data.
 */

export const GET_PRIVACY_JOB = ({ id }: { id: string }) =>
  db.privacyJob.findUnique({ where: { id } })

/**
 * Atomically take the job for erasure. False = the user cancelled first (job no longer
 * ACCEPTED/RUNNING). Pairs with CANCEL_ACCOUNT_DELETION, which only wins from ACCEPTED, so exactly
 * one side ever wins. RUNNING is allowed so a retry after a failed attempt can resume.
 */
export const CLAIM_PRIVACY_JOB = async ({ id }: { id: string }): Promise<boolean> =>
  (
    await db.privacyJob.updateMany({
      where: { id, state: { in: ['ACCEPTED', 'RUNNING'] } },
      data: { state: 'RUNNING' },
    })
  ).count === 1

export const SET_PRIVACY_JOB_STATE = ({ id, state }: { id: string; state: string }) =>
  db.privacyJob.update({ where: { id }, data: { state } })

/** What the finalize job must act on outside the database (Stripe). */
export const GET_ERASURE_CONTEXT = ({ userId }: { userId: string }) =>
  db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
      donationSubscriptions: {
        where: { provider_status: { notIn: ['canceled', 'incomplete_expired'] } },
        select: { provider_subscription_id: true },
      },
    },
  })

export const MARK_SUBSCRIPTION_CANCELED = ({
  providerSubscriptionId,
}: {
  providerSubscriptionId: string
}) =>
  db.donationSubscription.updateMany({
    where: { provider_subscription_id: providerSubscriptionId },
    data: { provider_status: 'canceled' },
  })

/**
 * The finalize step, in ONE transaction: soft-delete the user (same pattern as DEACTIVATE_USER:
 * status inactive + deleted_at), end every session and switch off whatever could still ACT on the
 * account. History is NOT touched: requests, follows, donations, check-ins, consents,
 * preferences, notification history, avatar and name stay. The EMAIL is freed for
 * re-registration: the original moves to `deleted_email`, `email` becomes a placeholder, and the
 * Google link (a login credential, not history) is removed so the same Google account can sign
 * up again too.
 */
export const SOFT_DELETE_USER = ({
  userId,
  jobId,
  requestId,
}: {
  userId: string
  jobId: string
  requestId: string
}) =>
  dbTransaction(async (tx) => {
    const now = new Date()
    const current = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, deleted_email: true },
    })
    // Repeat-safe: after the first run `email` is the placeholder, so keep the stored original.
    const originalEmail = current.deleted_email ?? current.email
    await tx.user.update({
      where: { id: userId },
      data: {
        status: 'inactive',
        deleted_at: now,
        auth_version: { increment: 1 },
        deleted_email: originalEmail,
        email: `deleted+${userId}@invalid`,
      },
      select: { id: true },
    })
    await tx.oAuthAccount.deleteMany({ where: { user_id: userId } })

    // Sessions end (revoked, not deleted). Unused verification / reset tokens are spent so no
    // link already in an inbox still works.
    await tx.authToken.updateMany({
      where: { user_id: userId, revoked_at: null, type: 'MOBILE_REFRESH' },
      data: { revoked_at: now },
    })
    await tx.authToken.updateMany({
      where: {
        user_id: userId,
        used_at: null,
        type: { in: ['EMAIL_VERIFICATION', 'PASSWORD_RESET'] },
      },
      data: { used_at: now },
    })
    // Push credentials have no history value and nothing may send to them any more. Delivery
    // rows stay (their device link is set to null by the FK).
    await tx.deviceToken.deleteMany({ where: { user_id: userId } })
    // A queued email to this address must not go out after the account is gone.
    await tx.outboxJob.updateMany({
      where: {
        kind: 'mail.send',
        state: 'PENDING',
        payload: { path: ['to'], equals: originalEmail },
      },
      data: { state: 'FAILED', last_error_code: 'RECIPIENT_DELETED' },
    })

    await tx.privacyJob.update({
      where: { id: jobId },
      data: { state: 'COMPLETED', completed_at: now },
    })
    await tx.auditLog.create({
      data: auditPayload({
        actorId: userId,
        action: 'account.delete.completed',
        resourceType: 'privacy_job',
        resourceId: jobId,
        outcome: 'success',
        requestId,
      }),
    })
  })
