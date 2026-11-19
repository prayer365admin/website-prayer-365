-- DropForeignKey
ALTER TABLE "media_assets" DROP CONSTRAINT "media_assets_church_id_fkey";

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
