import { z } from 'zod'

/*
 * Central notification-rule DTOs (SPEC §8.3 / F11 / plan Task 44).
 *
 * Only the enumerated notification types may be configured; there is no
 * campaign/segment schema. `offset_minutes` is restricted to an approved
 * allowlist (e.g. donation reminders may only be offset by those exact values).
 */

export const ALLOWED_RULE_TYPES = [
  'donation_reminder',
  'prayer_published',
  'event_reminder',
  'announcement_published',
] as const
export type NotificationRuleType = (typeof ALLOWED_RULE_TYPES)[number]

export const ALLOWED_OFFSET_MINUTES = [0, 60, 120, 180, 1440, 2880, 10080] as const

export const NotificationRuleTypeSchema = z.enum(ALLOWED_RULE_TYPES)

/* Non-null offset must be on the approved allowlist. */
const OffsetMinutesSchema = z
  .number()
  .int()
  .min(0)
  .refine((v) => (ALLOWED_OFFSET_MINUTES as readonly number[]).includes(v), {
    message: `offset_minutes must be one of: ${ALLOWED_OFFSET_MINUTES.join(', ')}`,
  })

export const NotificationRuleUpdateSchema = z
  .object({
    type: NotificationRuleTypeSchema,
    version: z.number().int().min(0),
    enabled: z.boolean().optional(),
    offset_minutes: z.union([OffsetMinutesSchema, z.null()]).optional(),
  })
  .refine((d) => d.enabled !== undefined || d.offset_minutes !== undefined, {
    message: 'provide at least one of enabled or offset_minutes to update',
  })
export type NotificationRuleUpdate = z.infer<typeof NotificationRuleUpdateSchema>

export const NotificationRulesUpdateSchema = z.array(NotificationRuleUpdateSchema).min(1)
export type NotificationRulesUpdate = z.infer<typeof NotificationRulesUpdateSchema>
