-- Onboarding progress (WB-15): when the language step was first filled (a
-- language chosen, not skipped). With church_setup_completed_at, now also set
-- only when a church is chosen, setup is complete once both are filled.
ALTER TABLE "user" ADD COLUMN "locale_setup_completed_at" TIMESTAMP(3);
