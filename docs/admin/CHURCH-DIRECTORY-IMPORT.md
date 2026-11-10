# Estonian church directory — import record

| Item     | Value                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Imported | 2026-11-11                                                                                                                                 |
| Source   | `PRAYER365_Estonian_Church_Directory.pdf` (document date 2026-11-09), CSV projection `estonian_church_directory.csv` (25 rows, 42 columns) |
| Script   | `src/script/import-church-directory.ts` (`bun run import:churches …`)                                                                      |
| Target   | PROD Postgres `prayer365` (RDS, eu-north-1) + S3 `prayer365-prayer-365-media`                                                              |
| Result   | 19 churches created, 6 updated, 25 `APPROVED`, 48 media assets in S3, 23 pastors, 31 service times                                         |
| Evidence | `.hermes/fixtures/church-directory/` (enriched, backups, results, credits — local, git-ignored)                                            |

## 1. What was imported

| Field           | Source column                            | Stored as                                                            |
| --------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| Church name     | `church_name`                            | `churches.name`                                                      |
| Slug            | generated                                | `churches.slug` (existing 6 keep theirs)                             |
| Denomination    | `denomination`                           | `churches.denomination`                                              |
| Timezone        | `timezone`                               | `churches.timezone`                                                  |
| Address         | `church_address` + `CITY_BY_ORDER`       | `churches.address` `{ line1, city }`                                 |
| Coordinates     | OSM way centroid from `building_map_url` | `churches.latitude` / `longitude`                                    |
| Email           | `church_email`                           | `churches.contacts.email` (phone kept from PROD, never from the CSV) |
| Website         | `parish_url`                             | `churches.website`                                                   |
| Description     | authored from et.wikipedia + parish page | `churches.description`                                               |
| Social links    | EELK congregation row                    | `churches.social_links` `[{url,label}]`                              |
| Service times   | EELK row (`Jumalateenistus …`)           | `service_times` (weekday, time, label, language)                     |
| Languages       | decision D9                              | `church_languages` = `et`                                            |
| Pastor          | `pastor_name` / `pastor_role`            | `pastors` + `church_pastors` (no login users)                        |
| Cover / hero    | `church_image_url`                       | `media_assets` (S3) → `cover_asset_id` + `hero_asset_id`             |
| Pastor photo    | `pastor_image_url`                       | `media_assets` (S3) → `pastors.image_asset_id`                       |
| Directory order | `directory_order`                        | `org_nodes.sort_order`                                               |

Org tree: every new church hangs under `Estonia Diocese` as a `CHURCH` node.

## 2. Not imported (no column, or deliberately skipped)

| CSV column                                   | Why                                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `church_phone`                               | masked in the source (`+372****5070`). PROD numbers kept for the 6 existing; the 19 new churches have email only |
| `building_footprint_m2`, `size_rank`         | no DB column — kept in `result-*.json → rowsResult[].sidecar`                                                    |
| `parish_office_address`, `venue_note`        | no DB column — same sidecar                                                                                      |
| `pastor_email`                               | no column on `pastors`; pastor logins were deliberately not created                                              |
| `voice_reference_*`, `prayer_*`              | reference pages / an unapproved shared test sample, not app content                                              |
| `church_image_credit`, `*_license`, `*_note` | no column — recorded in `credits.json`                                                                           |
| service-time clauses that state no weekday   | flagged, not guessed (`kord kuus 12.00 ja 15.00`)                                                                |

## 3. Images

48 files were downloaded, re-uploaded to `media/<churchId>/image/<uuid>` and attached as `READY` `IMAGE` assets. Wikimedia URLs are fetched at 1280 px (the camera original was 16 MB in one case). Each row keeps its source page, credit, licence and checksum in `credits.json`.

| Licence                                                        | Files |
| -------------------------------------------------------------- | ----- |
| `not_specified_in_pdf` (pastor photos from parish/press pages) | 23    |
| CC BY-SA 3.0 / 3.0 ee / 2.0 / 2.5 / 4.0                        | 20    |
| FAL                                                            | 3     |
| GFDL                                                           | 1     |
| CC BY 2.0                                                      | 1     |

**Attribution is not shown on the public pages** (owner decision). CC BY-SA / FAL / GFDL require credit + licence where the image is used, so this is an accepted risk until a credit line is added under the hero image.

## 4. Re-running

```bash
DOTENV_CONFIG_PATH=.env.prod bun run import:churches --collect-sources     # wiki + parish text
DOTENV_CONFIG_PATH=.env.prod bun run import:churches --check-descriptions  # copy guard
DOTENV_CONFIG_PATH=.env.prod bun run import:churches --enrich              # coordinates, socials, times
DOTENV_CONFIG_PATH=.env.prod bun run import:churches --dry-run             # plan + coverage, no writes
DOTENV_CONFIG_PATH=.env.prod bun run import:churches --apply               # rows (+ backup/result JSON)
DOTENV_CONFIG_PATH=.env.prod bun run import:churches --images              # media
DOTENV_CONFIG_PATH=.env.prod bun run import:churches --images --only=22 --kind=church   # retry one slot
DOTENV_CONFIG_PATH=.env.prod bun run import:churches --rollback=<result.json>
```

- Matching is by normalised name (curly vs straight apostrophes, `St.` vs `St`) plus one alias for Kaarli, so a re-run **updates** instead of duplicating.
- `--apply` refuses to run when a new church is missing coordinates, social links, service times or a description.
- The existing 6 churches are updated on CSV facts only — their curated description, social links, service times and gallery are never touched.
- Every write run prints the DB host and bucket first; the script refuses to run when `DATABASE_URL` is not the PROD RDS instance.

## 5. Still open

1. `church_style` on the 19 new churches (no source states a worship style).
2. Real phone numbers for the 19 new churches (needs an unmasked source).
3. Visible image attribution, if the client wants it.
4. Optional cleanup: duplicate `Toomas Nigola` pastor row, 4 ARCHIVED demo churches, unreferenced assets from the 6 replaced covers.
5. `building_footprint_m2` / `size_rank` reporting, if it is ever needed.
