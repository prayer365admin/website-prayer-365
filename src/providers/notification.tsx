import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'

/*
 * Notification-rule provider (plan Task 44). Thin Prisma adapter; the
 * controller owns validation, optimistic concurrency and the audit write.
 * Rows are global (type UNIQUE, no church), matching a central configuration
 * surface — no campaign/segment schema.
 */

export interface NotificationRuleData {
  enabled?: boolean
  offset_minutes?: number | null
}

export const GET_NOTIFICATION_RULES = async () => {
  const rows = await db.notificationRule.findMany({ orderBy: { type: 'asc' } })
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    enabled: r.enabled,
    offset_minutes: r.offset_minutes,
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
      offset_minutes: payload.offset_minutes ?? null,
      version: 1,
    },
    update: {
      ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
      ...(payload.offset_minutes !== undefined ? { offset_minutes: payload.offset_minutes } : {}),
      version: { increment: 1 },
    },
  })
