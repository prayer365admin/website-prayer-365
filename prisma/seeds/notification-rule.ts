import { db } from '../../src/utils/db-connection'

// SPEC F11 notification types. These are the TRIGGER names the sender looks up
// (models/notification.tsx ALLOWED_RULE_TYPES). All enabled: user preferences
// decide per-recipient delivery, and every type now defaults ON (client decision
// 2026-10-30). The old preference-name rows were invisible to the admin filter.
// `enabled` gates the type, `push_enabled`/`email_enabled` gate each leg. Push
// stays on (parity with the pre-channel behaviour); email is opt-in per type.
const rules = [
  { type: 'prayer_published', enabled: true, push_enabled: true, email_enabled: false },
  { type: 'announcement_published', enabled: true, push_enabled: true, email_enabled: false },
  { type: 'event_reminder', enabled: true, push_enabled: true, email_enabled: false },
  {
    type: 'donation_reminder',
    enabled: true,
    push_enabled: true,
    email_enabled: false,
    recurrence: null,
  },
]

export const seedNotificationRules = async () => {
  await db.notificationRule.createMany({ data: rules, skipDuplicates: true })
}
