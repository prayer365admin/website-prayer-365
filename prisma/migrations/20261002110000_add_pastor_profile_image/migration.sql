-- AlterTable
ALTER TABLE "pastors" ADD COLUMN "image_asset_id" TEXT;

-- CreateIndex
CREATE INDEX "pastors_image_asset_id_idx" ON "pastors"("image_asset_id");

-- AddForeignKey
ALTER TABLE "pastors"
ADD CONSTRAINT "pastors_image_asset_id_fkey"
FOREIGN KEY ("image_asset_id") REFERENCES "media_assets"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
