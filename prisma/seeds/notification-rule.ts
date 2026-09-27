import { db } from '../../src/utils/db-connection'

// SPEC F11 notification types + FEATURE.md: only these are required; donation
// reminder must be explicitly enabled by the user (matters at delivery time,
// rule row just defines the type here).
const rules = [
  { type: 'daily_prayer', enabled: true },
  { type: 'sunday_service', enabled: true },
  { type: 'church_events', enabled: true },
  { type: 'church_announcements', enabled: true },
  { type: 'platform_info', enabled: true },
  { type: 'donation_reminder', enabled: false },
]

export const seedNotificationRules = async () => {
  await db.notificationRule.createMany({ data: rules, skipDuplicates: true })
}
