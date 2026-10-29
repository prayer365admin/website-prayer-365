# PRAYER 365 — Demo Seed Runbook

| Field      | Value                                                           |
| ---------- | --------------------------------------------------------------- |
| Document   | SEED-DEMO — demo seed content, media upload and readiness gate  |
| Version    | 1.0                                                             |
| Date       | 25 October 2026                                                 |
| Author     | Catatia engineering                                             |
| Approver   | [TBD]                                                           |
| Applies to | `prayer-365-dashboard` — `prisma/seeds/**`, `src/script/seed-*` |

---

## 1. What this covers

The demo seed creates everything the client sees: five churches with covers, galleries, service
times, pastoral staff, events and announcements, and **prayers whose audio actually plays** on both
the website and the mobile app.

Three commands do the work:

| Command                   | What it does                                                                                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run seed:media`      | Uploads the demo files from `public/` into the **active** bucket (`AWS_BUCKET_NAME`) under `demo/`. Idempotent — an existing object is left untouched.                                                                            |
| `bunx tsx prisma/seed.ts` | The full demo seed (phases in §3). Creates rows and points them at the uploaded objects.                                                                                                                                          |
| `bun run seed:verify`     | The readiness gate: prints a per-church table and exits `1` when anything a visitor would notice is missing (no cover, no gallery, no staff, unpublished prayer, non-approved audio, relative audio URL, media object that 404s). |
| `bun run seed:demo`       | All three in order.                                                                                                                                                                                                               |

`seed:verify` is also the object-existence check: it sends a `HEAD` per seeded key, so a URL that
"looks fine" but points at a missing file fails the gate.

---

## 2. Why this document exists

The seed used to create four prayers for St. John's Church **with no audio row at all**, because the
church seeder ran before the media and voice seeds and its audio block was skipped when the voice
profile was still `null`. The demo prayer of the second church was never created either — its seeder
bailed out on "a prayer already exists". Media keys were `demo/<Church>-audio`-style placeholders that
no bucket ever contained, and four prayers pointed at `/audio/...` paths that the mobile app cannot
play.

The seed is now ordered so every media/voice dependency exists before the first prayer, no seeded row
references a local path or a missing object, and `seedChurchPrayers()` **throws** if a published prayer
ends up without an approved, selected audio asset.

---

## 3. Seed phases (order is load-bearing)

| Phase | Seeds                                                                                                         | Reason                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1     | `seedPermission`, `seedRoles`, `seedRolePermissions`                                                          | Permission catalogue before any grant                                        |
| 2     | `seedLanguages`, `seedCountries`, `seedOrgNodes`                                                              | Reference data + org hierarchy                                               |
| 3     | `seedAdminUser`                                                                                               | The actor every later seeder references                                      |
| 4     | `seedChurches`, `seedSecondChurch`, `seedStJohnsChurch`, `seedAdditionalChurches`                             | Church ROWS: profile, languages, service times, staff, events, announcements |
| 5     | `seedUsers`                                                                                                   | Staff test accounts + end users (needs org nodes and church rows)            |
| 6     | `seedPastors`, `ensureDemoMedia`, `seedMediaAssets`, `seedChurchContent`, `seedConsents`, `seedVoiceProfiles` | Every media + voice dependency, before any prayer                            |
| 7     | `seedChurchPrayers`, `seedVoiceActivations`                                                                   | Prayers with approved audio; fails loudly if not                             |
| 8     | `seedEvents`, `seedAnnouncements`, `seedRequests`, `seedDonations`, `seedNotificationRules`                   | Demo activity                                                                |

`prisma/seeds/demo-content.ts` holds the single content table (five churches: covers, gallery,
service times, staff, events, announcements, prayers). `prisma/seeds/demo-media.ts` holds the media
catalogue (local file → S3 key → content type) and the uploader.

---

## 4. Environments

Media keys resolve to `https://<AWS_BUCKET_NAME>.s3.<AWS_REGION>.amazonaws.com/<key>` (no signing, no
expiry — media is public by client decision, D13). The uploader therefore targets whichever bucket the
environment uses, so the same seed serves both environments.

| Environment                 | Database                                             | Bucket                       | Command prefix      |
| --------------------------- | ---------------------------------------------------- | ---------------------------- | ------------------- |
| Local                       | `DATABASE_URL` from `.env`                           | `bucket-catatia`             | `bun run seed:demo` |
| Catatia staging (live site) | `.env` `DATABASE_URL` (DigitalOcean `db_prayer_365`) | `bucket-catatia`             | `bun run seed:demo` |
| Client env                  | RDS `prayer365-prayer-365-*` (`eu-north-1`)          | `prayer365-prayer-365-media` | see §4.2            |

### 4.1 Local / catatia staging

```bash
bun run seed:demo            # media upload + seed + verification gate
```

### 4.2 Client environment

**Fast path — `.env.prod`** (gitignored, holds the client DB URL, the client bucket/region and the
CDK-created `prayer365-<env>-app` IAM key pair):

```bash
bun --env-file=.env.prod run seed:media
bun --env-file=.env.prod x tsx prisma/seed.ts
bun --env-file=.env.prod run seed:verify
```

`--env-file` sets the variables before dotenv loads, so the catatia values in `.env` cannot win. In
`.env` the client database is also present as a commented switcher line right below `DATABASE_URL` —
switch envs by commenting one of the two.

**Manual path** (no `.env.prod`, e.g. on another machine):

1. **Migrations first.** The client database must be at migration head (`churches.slug` and later
   columns are required by the seed):

   ```bash
   DATABASE_URL="$(aws --profile prayer-365 secretsmanager get-secret-value \
     --secret-id /prayer365/prayer-365/database-url --query SecretString --output text)" \
     bunx prisma migrate deploy
   ```

2. **Media into the client bucket** (the client bucket is created empty):

   ```bash
   AWS_PROFILE=prayer-365 AWS_BUCKET_NAME=prayer365-prayer-365-media bun run seed:media
   ```

3. **Seed and verify** with the same `DATABASE_URL` and `AWS_BUCKET_NAME`, then run
   `bun run seed:verify` and confirm the closing line is `DEMO-READY`.

Client credentials must be exported **before** dotenv loads (the repo `.env` holds the catatia account):
`eval "$(aws configure export-credentials --profile prayer-365 --format env)"`. Never print or commit the
database URL.

**Still unset in the client environment**: `elevenlabs-api-key`, `stripe-secret-key`,
`stripe-webhook-secret` and `mail-credentials` are CDK-generated random placeholders in Secrets Manager
(32-character strings, not real credentials). Replace them there before expecting audio generation,
payments or transactional mail to work — `.env.prod` lists them commented out for that reason.

### 4.3 Offline / CI runs

`SEED_SKIP_MEDIA_UPLOAD=1` skips every network call (no upload, no `HEAD`); the seed then still writes
all rows and `seed:verify` reports the object check as skipped.

---

## 5. Re-running the seed (what changes)

Every seeder is idempotent and keyed on a stable identity (church name, prayer title, event title,
announcement title, gallery `order_index`, media `object_key`). Re-running therefore:

| Content                                                              | Effect of a re-run                                                                                  |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Churches, service times, staff                                       | Created when missing, otherwise left/updated in place                                               |
| Covers                                                               | Set **only when the church has no cover** — a real uploaded cover is never replaced by a demo image |
| Galleries                                                            | Replaced exactly to the declared list; extra `order_index` rows are deleted                         |
| Events                                                               | Re-dated relative to today, so the list always has upcoming items                                   |
| Prayers                                                              | Text refreshed; the audio row is repointed at the demo object; `published_at` never reset           |
| Existing real content (e.g. the Estonian prayers already on staging) | Untouched                                                                                           |
| Media objects                                                        | Only missing objects are uploaded                                                                   |

On catatia staging a re-run therefore **adds** St. John's Church, St. Olaf's Church, Pärnu St.
Elizabeth's Church and their content, and fills the demo churches' galleries. It deletes nothing.

---

## 6. What the client sees after a successful run

| Surface                                   | Content                                                                                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Church directory                          | 5 churches, every card with a cover image and a worship-style pill                                                                                                                 |
| Church profile                            | description, address, contacts, social links, service times, pastoral staff, gallery (distinct images), upcoming events, announcements                                             |
| Prayers                                   | 10 published prayers across the 5 churches — St. John's 4, Tallinn Demo 2, Tartu 2, St. Olaf's 1, Pärnu 1 — each with an approved audio asset and a working player                 |
| Mobile home / prayer detail               | the same prayers with an absolute `https://` audio URL                                                                                                                             |
| Voice admin                               | the demo voice profile is READY with a real provider voice id (`DEMO_VOICE_PROVIDER_ID`, default a voice of the PRAYER ElevenLabs account) and a downloadable consent PDF + sample |
| Requests / donations / notification rules | 4 requests, 4 donations + 1 subscription, 6 notification rules at the demo church                                                                                                  |

Demo logins (password `Test123!` for all seeded accounts): `admin@catatia.com` (super admin),
`prayer_church_admin@example.com` (church-level), `believer@example.com` (mobile/website customer,
main parish St. John's Church), `visitor@example.com` (customer).

---

## 7. Acceptance / troubleshooting

| Symptom                                          | Cause                                                               | Fix                                                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `DEMO-READY` never printed                       | `seed:verify` lists the exact rows/objects at fault                 | read the problem list under the table; it names the church, prayer or object key                                                     |
| Audio plays on the web but is missing in the app | a seeded key starts with `/` (the app cannot play a relative URL)   | the gate flags `audio URL is not absolute`; move the file into the bucket via `demo-media.ts`                                        |
| `seedChurchPrayers: no READY voice profile`      | media/voice seeds did not run (custom order or a hand-run seeder)   | run the full `prisma/seed.ts`, or the phases in §3 order                                                                             |
| Audio job fails at the provider                  | `provider_voice_id` is not a voice of the PRAYER ElevenLabs account | set `DEMO_VOICE_PROVIDER_ID` to a real voice id (`curl -s https://api.elevenlabs.io/v1/voices -H "xi-api-key: $ELEVENLABS_API_KEY"`) |
| `ELEVENLABS_DISABLED`                            | `ELEVENLABS_ENABLED` must be exactly `true`                         | set it in the environment running the worker                                                                                         |

Object inventory can be confirmed independently of the gate:

```bash
aws s3api list-objects-v2 --bucket <bucket> --prefix demo/ \
  --query "Contents[].{Key:Key,Size:Size}" --output table
```

---

## 8. Known, accepted

- The demo reuses four recorded prayer audio files across the ten prayers; replace them with
  per-prayer recordings when the client supplies them.
- Two placeholder media rows from the previous seed remain in long-lived databases as unreferenced
  rows (`demo/<Church>-audio`, `-sample`, `-evidence`, `-gallery1`). No screen lists media assets, so
  they are invisible; they can be deleted once nothing references them.
- Pastors have no profile image, and gallery images are the demo photography that ships in `public/`.
