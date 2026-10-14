-- Onboarding progress (WB-15): when the parish step was first answered
-- (church chosen or skipped). Replaces the per-browser `site_setup_step`
-- cookie so the language step resumes on any device.
ALTER TABLE "user" ADD COLUMN "church_setup_completed_at" TIMESTAMP(3);
