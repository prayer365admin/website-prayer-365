# Viimsi Real-Data Seed

This document describes the real data created by `prisma/seeds/viimsi.ts`.

Sources:

- Church website: <https://viimsijaakobikirik.ee/>
- Sermon archive: <https://viimsijaakobikirik.ee/jutlused/>
- Clergy: <https://viimsijaakobikirik.ee/kontakt/vaimulikud/>
- Rohuneeme chapel: <https://viimsijaakobikirik.ee/rohuneeme-kabel/>

Data was reviewed on 26 October 2026.

## Running the seed

Run the general seed first so the shared administrator, languages, roles, test
role accounts, and Estonia hierarchy exist. Then run the Viimsi-only seed:

```bash
bun run seed:demo
bun run seed:viimsi
```

`seed:viimsi` only invokes the Viimsi church, role-assignment, customer,
announcement, and prayer seeders. It does not run the general seed or create
prayer audio.

## Relationship overview

```text
Estonia Diocese
└── Ida-Harju Deanery
    └── Viimsi Püha Jaakobi kirik Node
        └── Viimsi Püha Jaakobi kirik
            ├── ChurchLanguage: et
            ├── ServiceTime: 3 records
            ├── ChurchPastor
            │   └── Pastor: Mikk Leedjärv
            ├── RoleAssignment: dedicated Viimsi role accounts
            ├── UserChurch: 2 synthetic customers
            ├── Announcement: 1 published notice
            └── Prayer: 37 full-text records
                ├── 30 published LUGEMISEKS sermons
                └── 7 unreviewed client-provided drafts
                    └── PrayerAudio: never created by the seed
```

## Church

| Field        | Seed value                                                  |
| ------------ | ----------------------------------------------------------- |
| Name         | Viimsi Püha Jaakobi kirik                                   |
| Slug         | `viimsi-puha-jaakobi-kirik`                                 |
| Status       | `APPROVED`                                                  |
| Time zone    | `Europe/Tallinn`                                            |
| Denomination | Lutheran (EELK)                                             |
| Style        | Contemporary maritime sanctuary                             |
| Address      | Nurme tee 2, Haabneeme, Viimsi vald, 74001, Estonia         |
| Latitude     | `59.520729`                                                 |
| Longitude    | `24.808190`                                                 |
| Email        | `viimsi@eelk.ee`                                            |
| Phone        | `+372 607 5070`                                             |
| Website      | <https://viimsijaakobikirik.ee/>                            |
| Facebook     | <https://facebook.com/122938177717046>                      |
| YouTube      | <https://www.youtube.com/channel/UCwuACDzgj1tf35b4mcg9dOA/> |

Description:

> Viimsi Püha Jaakobi kirik is a modern Lutheran church consecrated on 25 July 2007. The first new Lutheran church built in Estonia after the Second World
> War, it is dedicated to all who have lost their lives at sea. Its architecture
> by Martin Aunin and Erkki Ristoja recalls the wooden boathouses of the Viimsi
> coast.

### Donation options

```json
{
  "currency": "EUR",
  "presetsMinor": [500, 1000, 2000, 5000, 10000],
  "monthlyEnabled": false
}
```

The preset amounts represent €5, €10, €20, €50, and €100.

## Organization nodes

| Model     | Kind      | Name                           | Parent            |
| --------- | --------- | ------------------------------ | ----------------- |
| `OrgNode` | `DEANERY` | Ida-Harju Deanery              | Estonia Diocese   |
| `OrgNode` | `CHURCH`  | Viimsi Püha Jaakobi kirik Node | Ida-Harju Deanery |

## Language

| Model            | Church                    | Language code |
| ---------------- | ------------------------- | ------------- |
| `ChurchLanguage` | Viimsi Püha Jaakobi kirik | `et`          |

## Service times

Weekdays use the database convention `1 = Monday` through `7 = Sunday`.

| Weekday            | Local time | Label                                                                  | Language |
| ------------------ | ---------- | ---------------------------------------------------------------------- | -------- |
| Tuesday (`2`)      | 18:00      | Katoliku missa                                                         | `et`     |
| Sunday (`7`)       | 11:00      | Teenistus armulauaga                                                   | `et`     |
| First Sunday (`7`) | 13:00      | Armulauaga jumalateenistus Rohuneeme kabelis (kuu esimesel pühapäeval) | `et`     |

The schema does not have a monthly recurrence field, so the first-Sunday rule is
preserved in the service label.

## Pastor

### `Pastor`

| Field        | Seed value                            |
| ------------ | ------------------------------------- |
| Name         | Mikk Leedjärv                         |
| Introduction | Viimsi Püha Jaakobi koguduse õpetaja. |

### `ChurchPastor`

| Field                | Seed value                |
| -------------------- | ------------------------- |
| Church               | Viimsi Püha Jaakobi kirik |
| Pastor               | Mikk Leedjärv             |
| Pastoral role        | Koguduseõpetaja           |
| Active voice profile | Not set or updated        |

## Role assignments

Roles are global system definitions and are not duplicated per church. The seed
creates a dedicated Viimsi account for each role and assigns it at the correct
organization level.

| Role                            | Dedicated account                           | Assignment scope               |
| ------------------------------- | ------------------------------------------- | ------------------------------ |
| `prayer_global_admin`           | `viimsi.global.admin@example.com`           | PRAYER Global Root             |
| `prayer_country_admin`          | `viimsi.country.admin@example.com`          | Estonia Country                |
| `prayer_diocese_admin`          | `viimsi.diocese.admin@example.com`          | Estonia Diocese                |
| `prayer_deanery_admin`          | `viimsi.deanery.admin@example.com`          | Ida-Harju Deanery              |
| `prayer_church_admin`           | `viimsi.church.admin@example.com`           | Viimsi Püha Jaakobi kirik Node |
| `prayer_pastor`                 | `viimsi.pastor@example.com`                 | Viimsi Püha Jaakobi kirik Node |
| `prayer_request_reader`         | `viimsi.request.reader@example.com`         | Viimsi Püha Jaakobi kirik Node |
| `prayer_private_request_reader` | `viimsi.private.request.reader@example.com` | Viimsi Püha Jaakobi kirik Node |
| `prayer_user`                   | `viimsi.user@example.com`                   | Viimsi Püha Jaakobi kirik Node |

The pastor account is linked to Mikk Leedjärv's `Pastor` record. No credentials
are created for Mikk's real public email address. The dedicated global admin is
the separate voice and prayer-text reviewer because the current central voice
review route requires global scope; the church admin performs Viimsi dashboard,
publication, and audio-generation actions.

The dedicated pastor login is:

```text
Email: viimsi.pastor@example.com
Password: Test123!
```

Every dedicated Viimsi role account uses the same local seed password.

## Customers

No real congregant or visitor information is publicly available or appropriate
to copy into the database. The seed therefore creates two synthetic customers:

| Email                         | Name                 | Locale | Main church | Followed |
| ----------------------------- | -------------------- | ------ | ----------- | -------- |
| `viimsi.believer@example.com` | Viimsi Demo Believer | `et`   | Yes         | Yes      |
| `viimsi.visitor@example.com`  | Viimsi Demo Visitor  | `et`   | Yes         | Yes      |

Both customers:

- are verified and have completed church/language onboarding;
- have no staff role or `RoleAssignment`;
- enable daily-prayer notifications;
- leave donation reminders disabled by default.

## Announcement

| Field        | Seed value                                                                                |
| ------------ | ----------------------------------------------------------------------------------------- |
| Title        | Näitus kirikus                                                                            |
| Body         | Meie kirikusse on paika saanud uus näitus. Avamine toimub 18. oktoobril peale teenistust. |
| Published at | `2026-10-12T09:00:00.000Z`                                                                |
| Source       | <https://viimsijaakobikirik.ee/>                                                          |

The homepage displayed this Facebook notice as “2 weeks ago” when reviewed on
26 October 2026. Therefore, 12 October 2026 is an explicitly inferred
publication date rather than a date printed by the source.

## Prayers

The seed uses the 30 full written sermons from the church’s `LUGEMISEKS`
collection (WordPress category `11`). It does not use the separate MP3-only
`KUULAMISEKS` list.

Each written sermon produces:

1. One `Prayer` owned by Viimsi Püha Jaakobi kirik.
2. One approved `PrayerVersion` in Estonian (`et`) assigned to Mikk Leedjärv.
3. The complete written sermon body from its source post.
4. `current_version_id` and `published_version_id` pointing to that version.
5. `published_at` set to the source post date.
6. No `PrayerAudio` record. Audio will be generated later with Mikk Leedjärv’s
   authorized voice profile.

The source slug is part of the prayer slug so the two posts named
“Jeesus – meie aitaja” remain separate prayers.

|   # | Published  | Title                                   | Written source                                                               |
| --: | ---------- | --------------------------------------- | ---------------------------------------------------------------------------- |
|   1 | 2025-10-12 | Kõik on Jumala arm                      | [Source](https://viimsijaakobikirik.ee/koik-on-jumala-arm/)                  |
|   2 | 2025-06-08 | Meie olemegi kirik                      | [Source](https://viimsijaakobikirik.ee/meie-olemegi-kirik/)                  |
|   3 | 2022-09-04 | Jeesus – meie aitaja                    | [Source](https://viimsijaakobikirik.ee/jeesus-meie-aitaja-2/)                |
|   4 | 2022-04-03 | Kannatustest kannatlikkusesse           | [Source](https://viimsijaakobikirik.ee/kannatustest-kannatlikkusesse/)       |
|   5 | 2021-08-22 | Jeesus – meie aitaja                    | [Source](https://viimsijaakobikirik.ee/jeesus-meie-aitaja/)                  |
|   6 | 2021-03-14 | Mina olen eluleib!                      | [Source](https://viimsijaakobikirik.ee/mina-olen-eluleib/)                   |
|   7 | 2021-02-07 | Jumala Sõna külv                        | [Source](https://viimsijaakobikirik.ee/jumala-sona-kulv/)                    |
|   8 | 2020-10-25 | Jeesuse saadikud                        | [Source](https://viimsijaakobikirik.ee/jeesuse-saadikud/)                    |
|   9 | 2020-10-11 | Tänu lõikuse eest                       | [Source](https://viimsijaakobikirik.ee/tanu-loikuse-eest/)                   |
|  10 | 2020-10-04 | Jõumala õiguse vesi                     | [Source](https://viimsijaakobikirik.ee/5560/)                                |
|  11 | 2020-09-27 | Jeesus annab elu                        | [Source](https://viimsijaakobikirik.ee/jeesus-annab-elu/)                    |
|  12 | 2020-09-20 | Jumala hoolitsus                        | [Source](https://viimsijaakobikirik.ee/jumala-hoolitsus/)                    |
|  13 | 2020-08-23 | Enese läbikatsumine                     | [Source](https://viimsijaakobikirik.ee/5515/)                                |
|  14 | 2020-03-29 | Kannatused kasvatavad kannatlikkust     | [Source](https://viimsijaakobikirik.ee/kannatused-kasvatavad-kannatlikkust/) |
|  15 | 2019-09-15 | Armsad, armastagem!                     | [Source](https://viimsijaakobikirik.ee/armsad-armastagem/)                   |
|  16 | 2019-05-26 | Südame kõne Jumalaga                    | [Source](https://viimsijaakobikirik.ee/5258/)                                |
|  17 | 2019-02-17 | Unistuste tööandja Jumal                | [Source](https://viimsijaakobikirik.ee/5200/)                                |
|  18 | 2018-10-14 | Tehke head ja pidage osadust!           | [Source](https://viimsijaakobikirik.ee/tehke-head-ja-pidage-osadust/)        |
|  19 | 2018-09-02 | Tänulikkus                              | [Source](https://viimsijaakobikirik.ee/tanulikkus/)                          |
|  20 | 2018-08-12 | Enesesse vaatamine, enese läbikatsumine | [Source](https://viimsijaakobikirik.ee/5039/)                                |
|  21 | 2018-03-25 | Alandlikkuse rõõm                       | [Source](https://viimsijaakobikirik.ee/alandlikkuse-room/)                   |
|  22 | 2018-03-11 | Eluleib                                 | [Source](https://viimsijaakobikirik.ee/eluleib/)                             |
|  23 | 2016-12-04 | Issanda tulemise ootus!                 | [Source](https://viimsijaakobikirik.ee/issanda-tulemise-ootus/)              |
|  24 | 2016-11-20 | Valik on sinu!                          | [Source](https://viimsijaakobikirik.ee/valik-on-sinu/)                       |
|  25 | 2015-11-08 | Kahe riigi kodanik                      | [Source](https://viimsijaakobikirik.ee/kahe-riigi-kodanik/)                  |
|  26 | 2015-10-25 | Sool, valgus, armastus?                 | [Source](https://viimsijaakobikirik.ee/sool-valgus-armastus/)                |
|  27 | 2015-10-11 | Jeesus ütleb: Mina olen eluleib!        | [Source](https://viimsijaakobikirik.ee/jeesus-utleb-mina-olen-eluleib/)      |
|  28 | 2015-03-01 | Milline on meie usk?                    | [Source](https://viimsijaakobikirik.ee/milline-on-meie-usk/)                 |
|  29 | 2014-05-18 | Taevariigi kodanikuna maailmas          | [Source](https://viimsijaakobikirik.ee/taevariigi-kodanikuna-maailmas/)      |
|  30 | 2014-01-31 | Jeesus äratab usule!                    | [Source](https://viimsijaakobikirik.ee/jeesus-aratab-usule/)                 |

The full source text and URL for every row are stored in
`prisma/seeds/data/viimsi-written-prayers.json`.

### Client-provided draft prayers

The client document
`docs/admin/SEED-DATA/Prayer365 näidispalved.docx` contains seven prayers
labeled only `I` through `VII`. The visible document contains no individual
titles, dates, introductions, or church name. Its DOCX metadata identifies Mikk
Leedjärv as creator and last editor and records creation on 5 October 2026.

The seed uses faithful titles `Näidispalve I` through `Näidispalve VII` rather
than inventing individual titles or publication dates. The original wording and
manual line breaks are preserved in
`prisma/seeds/data/viimsi-draft-prayers.json`.

| Label | Seed title      | Words | Main subject                                     |
| ----- | --------------- | ----: | ------------------------------------------------ |
| I     | Näidispalve I   |    95 | Praise, grace, gratitude, peace, and joy         |
| II    | Näidispalve II  |    70 | Strength from God and loving service             |
| III   | Näidispalve III |    57 | Christ's cross, repentance, and resurrection joy |
| IV    | Näidispalve IV  |    61 | Joy in Christ, trust, and freedom from worry     |
| V     | Näidispalve V   |   114 | Gratitude through trials and God's love          |
| VI    | Näidispalve VI  |    87 | Fellowship, Word, sacrament, and service         |
| VII   | Näidispalve VII |    97 | New life, love, and the heavenly home            |

Each of these seven records is seeded with:

- Mikk Leedjärv as pastor and Estonian (`et`) as language;
- the Viimsi church admin as creator;
- `current_version_id` pointing to its editable version;
- a short generated Estonian introduction (`introduction` in the JSON). The
  source document has none, so these were written by the development team
  from each prayer's content and should be confirmed by the pastor on review;
- no approval, reviewer, schedule, or publication date;
- no `published_version_id`, `PrayerAudio`, or audio-generation job.

The bulk Viimsi voice workflow selects published prayers only, so these drafts
are excluded even after Mikk's voice profile is ready. If an administrator later
reviews one of these drafts, rerunning the seed does not rewrite or demote it.

## Intentionally excluded

The Viimsi seed does not create or update any of the following:

- `VoiceProfile`
- `VoiceProfileSample`
- `Consent`
- `ChurchPastor.active_voice_profile_id`
- `PrayerAudio`
- generated-audio `MediaAsset` records
- prayer voice-generation jobs

These records are deliberately outside `seed:viimsi` because provider voice
creation and generated audio consume external services and credits. After
explicit authorization, use the resumable operator workflow instead:

```bash
bun run viimsi:voice-audio prepare-voice
bun run worker:voice-register -- --once
bun run viimsi:voice-audio enqueue-audio
bun run worker:audio-generate -- --once
bun run viimsi:voice-audio approve-audio
bun run viimsi:voice-audio status
```

`enqueue-audio` skips queued, generating, ready, and approved rows. A prayer
whose previous generation failed receives a new idempotency key, allowing it to
be retried safely after provider quota or configuration is restored.

## Idempotency

The seed can be run repeatedly:

- Organization nodes are matched by stable names.
- The church is matched by its official name.
- The language and pastor assignment use composite upserts.
- Service times are matched by church, weekday, and local time.
- Active role assignments are matched by user, role, and organization node.
- Synthetic customers are matched by email and linked through `UserChurch`.
- Announcements are matched by church and title.
- Prayers are matched by their stable church/source slug.
- Existing first versions and publication pointers are updated in place.
