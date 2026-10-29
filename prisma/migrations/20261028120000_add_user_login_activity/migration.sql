-- Track how and when a user last signed in / was active.
ALTER TABLE "user" ADD COLUMN "last_login_provider" TEXT;
ALTER TABLE "user" ADD COLUMN "last_active_at" TIMESTAMP(3);
