-- Add a stable public identifier so website routes never expose prayer IDs.
ALTER TABLE "prayers" ADD COLUMN "slug" TEXT;

-- Backfill from the current version title. The explicit Baltic/Nordic
-- transliteration keeps existing Estonian, Finnish, and Swedish titles readable.
WITH title_slugs AS (
  SELECT
    p."id",
    COALESCE(
      NULLIF(
        LEFT(
          TRIM(
            BOTH '-' FROM REGEXP_REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(
                    REPLACE(
                      REPLACE(
                        REPLACE(
                          REPLACE(LOWER(COALESCE(v."title", '')), 'ä', 'a'),
                          'ö',
                          'o'
                        ),
                        'õ',
                        'o'
                      ),
                      'ü',
                      'u'
                    ),
                    'å',
                    'a'
                  ),
                  'š',
                  's'
                ),
                'ž',
                'z'
              ),
              '[^a-z0-9]+',
              '-',
              'g'
            )
          ),
          140
        ),
        ''
      ),
      'prayer'
    ) AS "base_slug"
  FROM "prayers" p
  LEFT JOIN "prayer_versions" v ON v."id" = COALESCE(
    p."current_version_id",
    p."published_version_id"
  )
),
ranked AS (
  SELECT
    "id",
    "base_slug",
    ROW_NUMBER() OVER (PARTITION BY "base_slug" ORDER BY "id") AS "position"
  FROM title_slugs
),
candidates AS (
  SELECT
    "id",
    CASE
      WHEN "position" = 1 THEN "base_slug"
      ELSE "base_slug" || '-' || "position"
    END AS "candidate"
  FROM ranked
),
resolved AS (
  SELECT
    "id",
    CASE
      WHEN COUNT(*) OVER (PARTITION BY "candidate") = 1 THEN "candidate"
      ELSE LEFT("candidate", 140) || '-' || MD5("id")
    END AS "slug"
  FROM candidates
)
UPDATE "prayers" p
SET "slug" = resolved."slug"
FROM resolved
WHERE p."id" = resolved."id";

ALTER TABLE "prayers" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "prayers_slug_key" ON "prayers"("slug");
