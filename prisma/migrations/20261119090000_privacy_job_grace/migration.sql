-- MB-06 account deletion: grace window + cancel timestamp on the privacy job,
-- and an index for the "open deletion job for this user" lookup.
ALTER TABLE "privacy_jobs" ADD COLUMN "grace_ends_at" TIMESTAMP(3);
ALTER TABLE "privacy_jobs" ADD COLUMN "cancelled_at" TIMESTAMP(3);
CREATE INDEX "privacy_jobs_user_id_kind_state_idx" ON "privacy_jobs"("user_id", "kind", "state");
