import { NotificationRuleUpdate } from '@/models/notification'
import { ALLOWED_RULE_TYPES } from '@/models/notification'
import {
  GET_NOTIFICATION_RULE_BY_TYPE,
  GET_NOTIFICATION_RULES,
  UPSERT_NOTIFICATION_RULE,
} from '@/providers/notification'
import { auditPayload } from '@/utils/audit'
import { dbTransaction } from '@/utils/db-transaction'
import { GeneralError } from '@/utils/general-error'

/*
 * Central notification-rule controller (SPEC §8.3 / F11 / plan Task 44).
 * GET lists the configured (allowed) rules; PUT writes a batch of rules
 * transactionally, enforcing optimistic concurrency per type (stale -> 409)
 * and auditing every admin change. No campaign schema.
 */

const stale = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'STALE_VERSION',
    details: 'Notification rule has been modified; reload and retry.',
  })

type RuleRow = {
  id: string
  type: string
  enabled: boolean
  push_enabled: boolean
  email_enabled: boolean
  offset_minutes: number | null
  recurrence: string | null
  version: number
}

const ruleDto = (r: RuleRow) => ({
  id: r.id,
  type: r.type,
  enabled: r.enabled,
  push_enabled: r.push_enabled,
  email_enabled: r.email_enabled,
  offset_minutes: r.offset_minutes,
  recurrence: r.recurrence,
  version: r.version,
})

export const listNotificationRules = async () => {
  const rules = await GET_NOTIFICATION_RULES()
  // Expose only the allowed rule types on the central configuration surface.
  return rules.filter((r) => (ALLOWED_RULE_TYPES as readonly string[]).includes(r.type))
}

export const updateNotificationRules = async ({
  items,
  actorId,
  requestId,
}: {
  items: NotificationRuleUpdate[]
  actorId: string
  requestId: string
}) =>
  dbTransaction(async (tx) => {
    const updated: ReturnType<typeof ruleDto>[] = []

    for (const item of items) {
      const existing = await GET_NOTIFICATION_RULE_BY_TYPE({ type: item.type }, tx)
      if (existing && existing.version !== item.version) throw stale()

      // Only the fields the admin actually changed reach the row.
      const changes: {
        enabled?: boolean
        push_enabled?: boolean
        email_enabled?: boolean
        offset_minutes?: number | null
        recurrence?: string | null
      } = {}
      if (item.enabled !== undefined) changes.enabled = item.enabled
      if (item.push_enabled !== undefined) changes.push_enabled = item.push_enabled
      if (item.email_enabled !== undefined) changes.email_enabled = item.email_enabled
      if (item.offset_minutes !== undefined) changes.offset_minutes = item.offset_minutes
      if (item.recurrence !== undefined) changes.recurrence = item.recurrence

      const row = await UPSERT_NOTIFICATION_RULE({ type: item.type, payload: changes }, tx)

      await tx.auditLog.create({
        data: auditPayload({
          actorId,
          action: 'notification_rule.update',
          resourceType: 'notification_rule',
          resourceId: item.type,
          outcome: 'success',
          requestId,
        }),
      })

      updated.push(ruleDto(row))
    }

    return updated
  })
