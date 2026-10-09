-- Add church_id columns
ALTER TABLE "donations" ADD COLUMN "church_id" TEXT;
ALTER TABLE "donation_subscriptions" ADD COLUMN "church_id" TEXT;

-- Backfill from payment_accounts
UPDATE "donations" SET "church_id" = "payment_accounts"."church_id"
  FROM "payment_accounts" WHERE "donations"."payment_account_id" = "payment_accounts"."id";
UPDATE "donation_subscriptions" SET "church_id" = "payment_accounts"."church_id"
  FROM "payment_accounts" WHERE "donation_subscriptions"."payment_account_id" = "payment_accounts"."id";

ALTER TABLE "donations" ALTER COLUMN "church_id" SET NOT NULL;
ALTER TABLE "donation_subscriptions" ALTER COLUMN "church_id" SET NOT NULL;

-- Drop old FKs
ALTER TABLE "donations" DROP CONSTRAINT "donations_payment_account_id_fkey";
ALTER TABLE "donation_subscriptions" DROP CONSTRAINT "donation_subscriptions_payment_account_id_fkey";
ALTER TABLE "payment_accounts" DROP CONSTRAINT IF EXISTS "payment_accounts_church_id_fkey";

-- Drop old columns
ALTER TABLE "donations" DROP COLUMN "payment_account_id";
ALTER TABLE "donation_subscriptions" DROP COLUMN "payment_account_id";

-- Drop old indexes/uniques (names from 20260927021222 migration)
DROP INDEX IF EXISTS "donations_payment_account_id_provider_payment_id_key";
DROP INDEX IF EXISTS "donations_payment_account_id_paid_at_idx";
DROP INDEX IF EXISTS "donation_subscriptions_payment_account_id_provider_subscrip_key";
DROP INDEX IF EXISTS "donation_subscriptions_payment_account_id_provider_status_idx";

-- Deduplicate any old test rows before creating unique indexes
DELETE FROM "donations"
WHERE id NOT IN (
  SELECT DISTINCT ON ("provider_payment_id") id
  FROM "donations"
  ORDER BY "provider_payment_id", "created_at" DESC, id DESC
);

DELETE FROM "donation_subscriptions"
WHERE id NOT IN (
  SELECT DISTINCT ON ("provider_subscription_id") id
  FROM "donation_subscriptions"
  ORDER BY "provider_subscription_id", "created_at" DESC, id DESC
);

-- New uniques/indexes
CREATE UNIQUE INDEX "donations_provider_payment_id_key" ON "donations"("provider_payment_id");
CREATE INDEX "donations_church_id_paid_at_idx" ON "donations"("church_id", "paid_at");
CREATE UNIQUE INDEX "donation_subscriptions_provider_subscription_id_key" ON "donation_subscriptions"("provider_subscription_id");
CREATE INDEX "donation_subscriptions_church_id_provider_status_idx" ON "donation_subscriptions"("church_id", "provider_status");

-- New FKs
ALTER TABLE "donations" ADD CONSTRAINT "donations_church_id_fkey"
  FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "donation_subscriptions" ADD CONSTRAINT "donation_subscriptions_church_id_fkey"
  FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop per-church accounts table
DROP TABLE "payment_accounts";
