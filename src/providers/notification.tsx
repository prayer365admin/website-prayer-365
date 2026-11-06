import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'

/*
 * Notification-rule provider (plan Task 44). Thin Prisma adapter; the
 * controller owns validation, optimistic concurrency and the audit write.
 * Rows are global (type UNIQUE, no church), matching a central configuration
 * surface — no campaign/segment schema.
 *
 * `enabled` is the master switch; `push_enabled`/`email_enabled` gate each
 * delivery leg, and `recurrence` drives the donation-reminder schedule.
 */

export interface NotificationRuleData {
  enabled?: boolean
  push_enabled?: boolean
  email_enabled?: boolean
  offset_minutes?: number | null
  recurrence?: string | null
}

export const GET_NOTIFICATION_RULES = async () => {
  const rows = await db.notificationRule.findMany({ orderBy: { type: 'asc' } })
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    enabled: r.enabled,
    push_enabled: r.push_enabled,
    email_enabled: r.email_enabled,
    offset_minutes: r.offset_minutes,
    recurrence: r.recurrence,
    version: r.version,
    updated_at: r.updated_at?.toISOString() ?? null,
  }))
}

export const GET_NOTIFICATION_RULE_BY_TYPE = async (
  { type }: { type: string },
  tx: Prisma.TransactionClient = db,
) => tx.notificationRule.findUnique({ where: { type } })

export const UPSERT_NOTIFICATION_RULE = async (
  { type, payload }: { type: string; payload: NotificationRuleData },
  tx: Prisma.TransactionClient = db,
) =>
  tx.notificationRule.upsert({
    where: { type },
    create: {
      type,
      enabled: payload.enabled ?? true,
      push_enabled: payload.push_enabled ?? true,
      email_enabled: payload.email_enabled ?? false,
      offset_minutes: payload.offset_minutes ?? null,
      recurrence: payload.recurrence ?? null,
      version: 1,
    },
    update: {
      ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
      ...(payload.push_enabled !== undefined ? { push_enabled: payload.push_enabled } : {}),
      ...(payload.email_enabled !== undefined ? { email_enabled: payload.email_enabled } : {}),
      ...(payload.offset_minutes !== undefined ? { offset_minutes: payload.offset_minutes } : {}),
      ...(payload.recurrence !== undefined ? { recurrence: payload.recurrence } : {}),
      version: { increment: 1 },
    },
  })

export const ENQUEUE_NOTIFICATION = async (
  {
    type,
    resourceId,
    churchId,
    dedupeKeySuffix,
    availableAt = new Date(),
  }: {
    type: string
    resourceId: string
    churchId: string
    dedupeKeySuffix: string
    /** Earliest delivery time; reminder producers schedule ahead of the event. */
    availableAt?: Date
  },
  tx: Prisma.TransactionClient = db,
) =>
  tx.outboxJob.create({
    data: {
      kind: 'notification.send',
      dedupe_key: `notification.send:${type}:${dedupeKeySuffix}`,
      resource_id: resourceId,
      payload: { type, churchId },
      available_at: availableAt,
    },
  })

/**
 * Events whose reminder window opens now: `event_reminder` fires once, when
 * `starts_at - offset` is reached, so the sweep only looks one offset ahead.
 */
export const SCAN_EVENTS_STARTING_BETWEEN = async ({ from, to }: { from: Date; to: Date }) =>
  db.event.findMany({
    where: { starts_at: { gte: from, lt: to } },
    select: { id: true, church_id: true, starts_at: true },
    orderBy: { starts_at: 'asc' },
  })

/** Donation reminders are church-scoped: only approved churches are notified. */
export const LIST_APPROVED_CHURCH_IDS = async () =>
  db.church.findMany({
    where: { status: 'APPROVED' },
    select: { id: true },
    orderBy: { id: 'asc' },
  })
