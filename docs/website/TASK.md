# PRAYER Customer-Facing Website — Task Breakdown (TASK.md)

Prepared: 12 October 2026. Source docs:
`docs/website/{OVERVIEW,FEATURE,SPEC,DESIGN,BOM}.md`.

## How to Use

- Tasks are grouped per feature. Inside each feature work top-down: Foundation
  → Backend → Screens → Hooks → Tests.
- Each row is one small verifiable unit. Check off when done.
- "done" = passes verify + satisfies the acceptance hint in FEATURE.md.
- Verify after any change: `bun run typecheck && bun run lint && bun run test
&& bun run build` (BUN-managed repo — never `yarn install`).
- Cross-refs: `DESIGN W##` = screen, `SPEC §m` = this website SPEC,
  `WF#` = feature in docs/website/FEATURE.md.
- Follow the repo rules: layer architecture (app → contents → hooks →
  api/controller → provider), `requiredWebAuth` for website session guards, no
  direct Prisma in routes, `GeneralError` for expected errors, cache keys carry
  userId scope.
- Do NOT build deferred items. Do NOT commit/push — user handles all git.

Legend: ✔ done · ☐ pending · 🔒 blocked on shared backend MB-##/DO-## (admin TASK)

---

## WB-FND — Website Foundation (do first)

DESIGN W01 | SPEC §2, §3 | FEATURE WF1

| ID    | Task                                                                                                                                                                                                                                                    | Status |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WB-01 | Create `src/app/(site)/*` route group + shared website layout (top bar: brand, language switch en/et/sv/fi, account menu; footer).                                                                                                                      | ☐      |
| WB-02 | Add `src/utils/required-webauth.ts`: returns cookie session user, revalidates live user (active + `auth_version`), no role required.                                                                                                                    | ☐      |
| WB-03 | Add NextAuth **customer sign-in branch** (SPEC W1): allow role-less `User` to create a customer session without staff permissions. Update `src/auth.ts` `authorize` + `jwt`; add tests (role-less logs in, staff still logs in, no permission leakage). | ☐      |
| WB-04 | Website route guard: all site pages except public account pages require a session; unauthenticated → `/login`.                                                                                                                                          | ☐      |
| WB-05 | Add `sv` language seed (`prisma/seeds/language.ts`) + migration; expose `sv` in the language contract used by the language selector. Add `'sv'` to any website-facing language allowlist.                                                               | ☐      |
| WB-06 | Website i18n scaffold: en/et/sv/fi UI strings (website layer; mirror mobile keys, not imported).                                                                                                                                                        | ☐      |
| WB-07 | Verify: `bun run typecheck && bun run lint && bun run test && bun run build`.                                                                                                                                                                           | ☐      |

## WB1 — User Onboarding

DESIGN W01–W05, W13 | SPEC §7.1 | FEATURE WF1

| ID    | Task                                                                                                                                                             | Status |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WB-11 | Sign in (W01): reuse `/login` + NextAuth, wire customer branch (WB-03); unverified-email message with resend link; go to `/setup` if not set up else `/`.        | ☐      |
| WB-12 | Register (W02): reuse existing `/register` + `/api/v1/auth/signup`; success "check your email" state.                                                            | ☐      |
| WB-13 | Verify email (W03): `/verify-email` success/error + resend link.                                                                                                 | ☐      |
| WB-14 | Forgot/reset (W04): reuse `/forgot-password` + `/reset-password`; soft-success (no enumeration); reset → sign in.                                                | ☐      |
| WB-15 | Setup (W05): `/setup` — language cards (en/et/sv/fi) → choose main church (search approved) → follow extra churches; Finish → `/`. Later reachable from profile. | ☐      |
| WB-16 | Profile (W13): view/edit name, locale, main church, follows; profile picture upload (reuse avatar path); sign out.                                               | ☐      |
| WB-17 | Tests: register→verify→sign-in end to end, unverified blocked, reset flow, setup persistence, main-church single `is_main` (transactional).                      | ☐      |
| WB-18 | Backend contracts: verify `registerUser` returns `role_id = null` customer; `getMe`/`patchMe` support main-church + locale + picture.                            | ☐      |

## WB2 — Church Directory

DESIGN W07–W08 | SPEC §7.2 | FEATURE WF2

| ID    | Task                                                                                                                                                               | Status |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| WB-21 | Directory (W07): search approved churches (name/city) via `listPublicChurches`; approved only; card with cover + name + city + denomination.                       | ☐      |
| WB-22 | Church profile (W08): `getPublicChurch` → cover (`coverUrl`), description, address, contacts, website, languages, accessibility, service times (local wall clock). | ☐      |
| WB-23 | Entry points: church profile → "View prayers" (WB3) and "Donate" (WB4).                                                                                            | ☐      |
| WB-24 | Tests: suspended/archived church never returned; no private field exposure; service time localized as church wall clock.                                           | ☐      |

## WB3 — Prayer

DESIGN W06, W09–W10 | SPEC §7.3 | FEATURE WF3

| ID    | Task                                                                                                                                       | Status |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| WB-31 | Home (W06): `getHome` projection → main + followed churches, latest published prayers; greeting; empty state → Go to directory.            | ☐      |
| WB-32 | Prayer list/archive (W09): `/churches/:churchId/prayers` + `/prayers` via `listPublishedPrayers`; pagination per list contract.            | ☐      |
| WB-33 | Prayer detail (W10): title, church + pastor attribution, introduction, full body, text width/accessibility controls.                       | ☐      |
| WB-34 | Audio player: build playback URL from the approved audio asset via `S3_PUBLIC_URL` (public bucket, D13); text-only when no approved audio. | ☐      |
| WB-35 | Tests: draft/unapproved prayer never appears; approved-audio shows player, no-audio shows text-only; public URL plays without auth header. | ☐      |

## WB4 — Donations (website UI)

DESIGN W11–W12 | SPEC §7.4, §6.2 | FEATURE WF4

The Stripe backend is already planned in the admin docs and is a shared backend
capability. The website must NOT rebuild it — it reuses the shared donation
controller the backend owns. See the "Shared backend reuse" block below for the
exact admin task IDs that deliver each piece.

| ID    | Task                                                                                                                                                                                                                                                                          | Status      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| WB-40 | Website donation integration (thin): server-side route handler calls the shared donation controller the backend owns (built by MB-02) with the NextAuth session user; launches one-time/montly provider checkout; keeps an idempotency key. No new Stripe/provider code here. | 🔒 MB-02    |
| WB-41 | Donate screen (W11): one-time/monthly toggle, predefined + custom amount, currency shown (currencies/presets from the shared DonationOptions, MB-03); disabled + "not ready yet" while the backend donation launch is unavailable.                                            | 🔒 MB-02/03 |
| WB-42 | Result page (W12): confirmed/pending/failed from the recorded donation attempt (MB-02 outcome), never from the URL alone; summary church/amount/currency/type.                                                                                                                | 🔒 MB-02    |
| WB-43 | Donation hooks: initiate + status query hooks (TanStack Query), idempotency key on initiate.                                                                                                                                                                                  | ☐           |
| WB-44 | Tests: donate button disabled when backend unavailable; initiate idempotent; result reflects confirmed state; no fabricated success (UI only — backend Stripe tests are DO-08).                                                                                               | ☐           |

Status note: MB-02/MB-03 are ☐ in `docs/TASK.md` (admin). WB4 is blocked until
those land. When they do, mark WB4 unblocked — do NOT re-plan the backend.

## Shared backend reuse — do NOT rebuild in the website

The donation backend already lives in the admin plan. Website tasks reference
these IDs instead of creating new ones:

| Admin task (docs/TASK.md) | Delivers for the website                                                   | Website task using it   |
| ------------------------- | -------------------------------------------------------------------------- | ----------------------- |
| DO-02 (F8DO)              | Stripe/donation providers + controllers + webhook route shell              | WB-40                   |
| DO-05 (F8DO)              | Stripe webhook: signature verify, durable receipt + outbox                 | WB-42 (confirmed state) |
| DO-06 (F8DO)              | `payment.sync`: dedupe/reconcile events, upsert donation + installments    | WB-42 (confirmed state) |
| DO-08 (F8DO)              | Backend Stripe tests (duplicates, out-of-order, installments)              | WB-44 (UI tests only)   |
| MB-02 (X-MOB)             | `POST M/churches/:churchId/donations` + attempt status                     | WB-40, WB-42            |
| MB-03 (X-MOB)             | `DonationOptions` on the public church (currencies, presets, monthly flag) | WB-41                   |

Conventions: the backend owns the API contract. If the shared donation
controller needs a website-specific launch shape, the website maps it — it
never forces a backend rename. Do not create `WN-*` tasks; these shared items
are single-sourced in `docs/TASK.md`.

## Build order (suggested)

1. WB-FND (WB-01→WB-07) — foundation + customer auth, unblocks everything.
2. WB1 Onboarding (needs WB-03 WB-04).
3. WB2 Directory + WB3 Prayer (independent; build together, reuse public controllers).
4. WB4 Donations (website UI only) — blocked on shared backend MB-02/MB-03; build the UI once those land. No website-side backend Stripe work.
5. WB-06 i18n across features as they land (en first, then et/sv/fi).

## Open decisions (blocking — do not guess, confirm with owner)

| Ref | Question                                                                      | Blocks                       |
| --- | ----------------------------------------------------------------------------- | ---------------------------- |
| W1  | Customer NextAuth branch (role-less session vs `prayer_user` role on signup). | WB-03, WB-11, all onboarding |
| W2  | Donation payment model/currencies/presets/monthly (links admin D6).           | MB-03, WB-41                 |
| W3  | Stripe Connect per-church account onboarding + fees + success/cancel URLs.    | MB-02 (backend), WB-40       |
| W4  | Prayer language filtering at launch.                                          | WB-31, WB-32                 |
| W5  | Website privacy notice / legal text.                                          | WB-12 (registration)         |

## Deployment and release

- The website ships in the same Next.js deployment as the admin (same app).
  Add a customer-facing domain in the shared Vercel/domain configuration.
- Enable `STRIPE_ENABLED` only after the shared backend donations land and pass
  end to end (admin DO-02/05/06/08, MB-02/03 — not website-side work).
- Handover: reuse the admin repo runbook/env names; add the website env vars
  (Stripe key/signing secret, public base URL).

## Definition of done

- All WB-FND + WB1 + WB2 + WB3 rows ✔; WB4 rows ✔ (or explicitly deferred with
  the donate button disabled until shared backend MB-02/MB-03 land).
- `bun run typecheck && bun run lint && bun run test && bun run build` GREEN.
- Verified: a new customer registers → verifies → signs in → chooses language
  and main church → reads/listens to a prayer → donates (one-time + monthly)
  and the webhook-created donation is visible to staff in the admin dashboard.
- En/et/sv/fi present; no guest content; website users cannot reach admin
  routes.

## Summary

Foundation = customer-friendly NextAuth auth + a website session guard, the
only blocking pre-requisite. Then onboarding, directory, and prayer reuse
existing backend. Donations are website UI only — the Stripe backend is already
planned in the admin docs (DO-02/05/06/08, MB-02/03) and is reused, not rebuilt.
No new database tables are needed; only a small `sv` language seed.
