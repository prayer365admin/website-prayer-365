-- AlterTable
ALTER TABLE "churches" ADD COLUMN "slug" TEXT;

-- backfill: deterministic slug = lowercased name, hyphens for non-alphanumerics (matches customSlugify lower/strict/replacement), suffix -<left(lower(md5(id::text)),6)> only on collision
UPDATE "churches"
SET "slug" = regexp_replace(lower(trim("name")), '[^a-z0-9]+', '-', 'g') ||
             CASE WHEN regexp_replace(lower(trim("name")), '[^a-z0-9]+', '-', 'g') = '' THEN 'church' ELSE '' END;

-- dedupe collisions deterministically by appending id hash (repeat until unique)
UPDATE "churches" c
SET "slug" = c."slug" || '-' || substr(md5(c."id"::text), 1, 6)
WHERE EXISTS (SELECT 1 FROM "churches" x WHERE x."slug" = c."slug" AND x."id" <> c."id");

-- CreateIndex
CREATE UNIQUE INDEX "churches_slug_key" ON "churches"("slug");

-- make NOT NULL only after backfill guarantees coverage
ALTER TABLE "churches" ALTER COLUMN "slug" SET NOT NULL;
