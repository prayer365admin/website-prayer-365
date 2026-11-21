# Local demo database — prerequisites before you capture or click through

> Audience: anyone running this repo's console against the local Postgres (`db_prayer_365`).
> Measured 2026-11-20 while capturing the donations and customer screens.

`.env` points `DATABASE_URL` at `localhost:5432/db_prayer_365`. The database is demo-seeded, but it
is **not** automatically migrated or fully granted, and each gap shows up as a different symptom:

| Prerequisite             | Command                                            | Symptom when skipped                                                                                                                                                                                |
| ------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations applied       | `bunx prisma migrate deploy`                       | **Staff sign-in fails** with `error=Configuration` and the server log shows `PrismaClientKnownRequestError: The column user.deleted_email does not exist` — the login query now selects new columns |
| Platform beneficiary row | `bunx tsx prisma/seeds/platform-church.ts`         | `/dashboard/donations` answers `503 DONATIONS_NOT_READY`; `/give` refuses a gift                                                                                                                    |
| Donation permission      | `bun run seed:permissions`                         | The donations page renders "Access restricted" even for an administrator, and the **Donations** sidebar entry is missing                                                                            |
| Prisma client generated  | `bun prisma generate` (also runs on `bun run dev`) | `bun run typecheck` reports missing `grace_ends_at` / `invoice_url` / `deleted_email` fields                                                                                                        |

## Order that works

```bash
bun prisma generate
bunx prisma migrate deploy
bunx tsx prisma/seeds/platform-church.ts
bun run seed:permissions
PORT=3200 bun run dev
```

`prisma generate` also runs as part of `bun run dev` and `bun run build`; `bun run typecheck` does
**not** generate, so a fresh clone fails typecheck until it is run once.

## Signing in for a capture

Demo logins are documented in the repository skill reference (`local-demo-run`): `admin@catatia.com`
is the super administrator. Credentials belong in the terminal's environment at run time — never in
a file, a plan or a commit.

Headless capture needs the session cookie, and cookies do not survive between browser calls, so
sign in over HTTP and inject the cookie in the same call as the capture:

```bash
TOKEN=$(curl -s -c "$J" http://127.0.0.1:3200/api/auth/csrf | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
curl -s -b "$J" -c "$J" -o /dev/null -X POST http://127.0.0.1:3200/api/auth/callback/credentials \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "csrfToken=$TOKEN" \
  --data-urlencode "name=admin@catatia.com" \
  --data-urlencode "password=$DEMO_PASSWORD" \
  --data-urlencode "callbackUrl=http://127.0.0.1:3200/dashboard" \
  --data-urlencode "json=true"
```

The credentials provider reads the email from a field called **`name`**, not `email`: a probe that
posts `email=` gets a 302 with no session cookie.

## Caching that looks like a bug

`GET_PLATFORM_CHURCH` is wrapped in `unstable_cache` with `revalidate: 60`. After seeding the
platform row, `/admin/donations` can keep answering `503` for up to a minute. Wait, do not re-seed.
