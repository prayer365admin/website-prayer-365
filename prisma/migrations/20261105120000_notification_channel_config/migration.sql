-- Per-channel switches for notification rules (F11). `enabled` stays the master
-- switch; these gate the push and email legs independently.
ALTER TABLE "notification_rules" ADD COLUMN "push_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_rules" ADD COLUMN "email_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Calendar recurrence for donation reminders only ('weekly' | 'monthly' | NULL).
ALTER TABLE "notification_rules" ADD COLUMN "recurrence" TEXT;
