-- CreateTable
CREATE TABLE "general_prayers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "introduction" TEXT,
    "body" TEXT NOT NULL,
    "verse" TEXT,
    "verse_reference" TEXT,
    "liturgical_note" TEXT,
    "references" TEXT,
    "language_code" CHAR(5) NOT NULL DEFAULT 'et',
    "audio_status" "AudioStatus" NOT NULL DEFAULT 'QUEUED',
    "audio_asset_id" TEXT,
    "provider_request_id" TEXT,
    "last_error_code" TEXT,
    "audio_generated_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "general_prayers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "general_prayers_slug_key" ON "general_prayers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "general_prayers_sequence_key" ON "general_prayers"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "general_prayers_audio_asset_id_key" ON "general_prayers"("audio_asset_id");

-- CreateIndex
CREATE INDEX "general_prayers_is_active_sequence_idx" ON "general_prayers"("is_active", "sequence");

-- AddForeignKey
ALTER TABLE "general_prayers" ADD CONSTRAINT "general_prayers_audio_asset_id_fkey" FOREIGN KEY ("audio_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "general_prayers" ADD CONSTRAINT "general_prayers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
