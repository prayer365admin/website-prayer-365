-- F4VO V7: a voice submission holds 1..N sample files instead of one.

-- CreateTable
CREATE TABLE "voice_profile_samples" (
    "voice_profile_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "position" SMALLINT NOT NULL,
    "checksum" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_profile_samples_pkey" PRIMARY KEY ("voice_profile_id","position")
);

-- CreateIndex
CREATE INDEX "voice_profile_samples_asset_id_idx" ON "voice_profile_samples"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "voice_profile_samples_voice_profile_id_asset_id_key" ON "voice_profile_samples"("voice_profile_id", "asset_id");

-- AddForeignKey
ALTER TABLE "voice_profile_samples" ADD CONSTRAINT "voice_profile_samples_voice_profile_id_fkey" FOREIGN KEY ("voice_profile_id") REFERENCES "voice_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_profile_samples" ADD CONSTRAINT "voice_profile_samples_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every existing profile keeps its single sample at position 0,
-- carrying the checksum frozen at submit (null for drafts).
INSERT INTO "voice_profile_samples" ("voice_profile_id", "asset_id", "position", "checksum", "created_at")
SELECT "id", "sample_asset_id", 0, "approved_sample_checksum", "created_at"
FROM "voice_profiles";

-- DropForeignKey
ALTER TABLE "voice_profiles" DROP CONSTRAINT "voice_profiles_sample_asset_id_fkey";

-- AlterTable
ALTER TABLE "voice_profiles" DROP COLUMN "approved_sample_checksum",
DROP COLUMN "sample_asset_id";
