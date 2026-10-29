-- Staff avatars need a user-scoped media asset: `media_assets.church_id` becomes
-- nullable and the new USER_AVATAR purpose carries no church.
ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'USER_AVATAR';

ALTER TABLE "media_assets" ALTER COLUMN "church_id" DROP NOT NULL;

ALTER TABLE "user" ADD COLUMN "profile_asset_id" TEXT;

CREATE INDEX "user_profile_asset_id_idx" ON "user"("profile_asset_id");

ALTER TABLE "user"
ADD CONSTRAINT "user_profile_asset_id_fkey"
FOREIGN KEY ("profile_asset_id") REFERENCES "media_assets"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
