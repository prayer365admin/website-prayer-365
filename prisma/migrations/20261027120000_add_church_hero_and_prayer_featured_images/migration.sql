-- Keep the existing church cover as the directory thumbnail and add a
-- dedicated hero image for the public church profile.
ALTER TABLE "churches" ADD COLUMN "hero_asset_id" TEXT;

-- A prayer owns one optional featured image independently of its text versions.
ALTER TABLE "prayers" ADD COLUMN "featured_asset_id" TEXT;

CREATE INDEX "churches_hero_asset_id_idx" ON "churches"("hero_asset_id");
CREATE INDEX "prayers_featured_asset_id_idx" ON "prayers"("featured_asset_id");

ALTER TABLE "churches"
ADD CONSTRAINT "churches_hero_asset_id_fkey"
FOREIGN KEY ("hero_asset_id") REFERENCES "media_assets"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prayers"
ADD CONSTRAINT "prayers_featured_asset_id_fkey"
FOREIGN KEY ("featured_asset_id") REFERENCES "media_assets"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
