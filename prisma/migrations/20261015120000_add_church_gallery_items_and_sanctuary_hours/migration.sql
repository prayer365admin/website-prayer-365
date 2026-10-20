-- AlterTable
ALTER TABLE "churches" ADD COLUMN "sanctuary_hours" TEXT;

-- CreateTable
CREATE TABLE "church_gallery_items" (
    "id" TEXT NOT NULL,
    "church_id" TEXT NOT NULL,
    "media_asset_id" TEXT NOT NULL,
    "caption" TEXT,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "church_gallery_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "church_gallery_items_church_id_order_index_idx" ON "church_gallery_items"("church_id", "order_index");

-- AddForeignKey
ALTER TABLE "church_gallery_items" ADD CONSTRAINT "church_gallery_items_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "church_gallery_items" ADD CONSTRAINT "church_gallery_items_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
