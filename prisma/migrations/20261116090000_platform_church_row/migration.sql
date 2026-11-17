-- The hidden platform beneficiary (PD-DB-03), created before the first seed so a
-- fresh production database has `/give` working as soon as the app starts.
-- `churches.id` is a TEXT column with a client-side uuid(7) default, so the row
-- mints its own id here. The org node is seed-owned: when it does not exist yet
-- this INSERT is a no-op and `prisma db seed` creates both rows, which stays the
-- idempotent source of truth.
INSERT INTO "churches" (
  "id",
  "org_node_id",
  "name",
  "slug",
  "status",
  "timezone",
  "is_platform",
  "address",
  "contacts",
  "social_links",
  "donation_options",
  "created_at",
  "updated_at",
  "version"
)
SELECT
  gen_random_uuid()::text,
  n."id",
  'Prayer 365',
  'prayer365',
  'APPROVED',
  'Europe/Tallinn',
  true,
  '{}'::jsonb,
  '{"email": null, "phone": null}'::jsonb,
  '[]'::jsonb,
  '{"currency": "EUR", "presetsMinor": [500, 1000, 2500, 5000], "monthlyEnabled": false}'::jsonb,
  now(),
  now(),
  1
FROM "org_nodes" n
WHERE n."kind" = 'CHURCH'
  AND n."name" = 'Prayer 365'
  AND n."parent_id" IS NULL
ON CONFLICT ("slug") DO NOTHING;
