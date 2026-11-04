import { db } from '../../src/utils/db-connection'

// SPEC F11 notification types. These are the TRIGGER names the sender looks up
// (models/notification.tsx ALLOWED_RULE_TYPES). All enabled: user preferences
// decide per-recipient delivery, and every type now defaults ON (client decision
// 2026-10-30). The old preference-name rows were invisible to the admin filter.
const rules = [
  { type: 'prayer_published', enabled: true },
  { type: 'announcement_published', enabled: true },
  { type: 'event_reminder', enabled: true },
  { type: 'donation_reminder', enabled: true },
]

export const seedNotificationRules = async () => {
  await db.notificationRule.createMany({ data: rules, skipDuplicates: true })
}
