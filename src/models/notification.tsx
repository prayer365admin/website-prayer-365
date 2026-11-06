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

/* Calendar recurrence, available only for donation reminders. */
export const ALLOWED_RECURRENCES = ['weekly', 'monthly'] as const
export type NotificationRecurrence = (typeof ALLOWED_RECURRENCES)[number]

export const NotificationRuleTypeSchema = z.enum(ALLOWED_RULE_TYPES)
export const NotificationRecurrenceSchema = z.enum(ALLOWED_RECURRENCES)

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
    push_enabled: z.boolean().optional(),
    email_enabled: z.boolean().optional(),
    offset_minutes: z.union([OffsetMinutesSchema, z.null()]).optional(),
    recurrence: z.union([NotificationRecurrenceSchema, z.null()]).optional(),
  })
  .refine(
    (d) =>
      d.enabled !== undefined ||
      d.push_enabled !== undefined ||
      d.email_enabled !== undefined ||
      d.offset_minutes !== undefined ||
      d.recurrence !== undefined,
    {
      message:
        'provide at least one of enabled, push_enabled, email_enabled, offset_minutes or recurrence to update',
    },
  )
  .refine(
    (d) => d.recurrence === undefined || d.recurrence === null || d.type === 'donation_reminder',
    {
      message: 'recurrence is only configurable for donation_reminder',
      path: ['recurrence'],
    },
  )
export type NotificationRuleUpdate = z.infer<typeof NotificationRuleUpdateSchema>

export const NotificationRulesUpdateSchema = z.array(NotificationRuleUpdateSchema).min(1)
export type NotificationRulesUpdate = z.infer<typeof NotificationRulesUpdateSchema>
