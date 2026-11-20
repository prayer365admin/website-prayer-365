-- MB-06: a soft-deleted customer frees its email for re-registration. The original address moves
-- to `deleted_email` (nothing is lost) and `email` becomes an unroutable placeholder.
ALTER TABLE "user" ADD COLUMN "deleted_email" TEXT;

-- Backfill accounts already soft-deleted by the account-deletion job. Staff deactivated through
-- the user screen (also `deleted_at`) are NOT touched: only accounts with a COMPLETED job.
UPDATE "user" u
SET "deleted_email" = u."email",
    "email" = 'deleted+' || u."id" || '@invalid'
WHERE u."email" NOT LIKE 'deleted+%@invalid'
  AND EXISTS (
    SELECT 1 FROM "privacy_jobs" j
    WHERE j."user_id" = u."id" AND j."kind" = 'account_delete' AND j."state" = 'COMPLETED'
  );
