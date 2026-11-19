-- MB-06: optional free-text reason for leaving, sent with the deletion request.
ALTER TABLE "privacy_jobs" ADD COLUMN "reason" TEXT;
