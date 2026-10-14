# PRAYER customer-facing website task breakdown

Prepared: 12 October 2026. Source docs:
`docs/website/{OVERVIEW,FEATURE,SPEC,DESIGN,BOM}.md`.

## How to use

- Tasks group by feature. Inside each feature, work top-down: Foundation,
  Backend, Screens, Hooks, Tests.
- Each row is one small verifiable unit. Check off when done.
- "done" = passes verify and satisfies acceptance hint in FEATURE.md.
- Verify after any change: `bun run typecheck && bun run lint && bun run test
&& bun run build`. BUN manages this repo. Never run yarn install.
- Cross references: `DESIGN W##` = screen, `SPEC §m` = website SPEC,
  `WF#` = feature in docs/website/FEATURE.md.
- Follow repo rules: layer architecture (app, contents, hooks, api,
  controller, provider), `requiredWebAuth` for website session guards, no
  direct Prisma in routes, `GeneralError` for expected errors, cache keys carry
  userId scope.
- Do not build deferred items. Do not commit or push. User handles all git.

## Legend: ✔ done · ☐ pending · 🔒 blocked on shared backend MB-##/DO-## in admin docs

## WB-FND. Website foundation, do first

DESIGN W01 | SPEC §2, §3 | FEATURE WF1

| ID    | Task                                                                                                                                                                                                    | Status |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WB-01 | Create `src/app/(site)/*` route group and shared website layout with top bar brand, language switch for en, et, sv, fi, account menu, and footer.                                                       | ☐      |
| WB-02 | Add `src/utils/required-webauth.ts`. Return cookie session user, revalidate live user with active and `auth_version`, no role required.                                                                 | ☐      |
| WB-03 | Add NextAuth customer sign-in branch for SPEC W1. Allow role-less `User` to create customer session without staff permissions. Update `src/auth.ts` `authorize` and `jwt`. Add tests to verify no leak. | ☐      |
| WB-04 | Website route guard: all site pages except public account pages require a session. Unauthenticated requests redirect to `/login`.                                                                       | ☐      |
| WB-05 | Add `sv` language seed in `prisma/seeds/language.ts` and migration. Expose `sv` in language contract used by language selector. Add `'sv'` to website language allowlist.                               | ☐      |
| WB-06 | Website i18n setup: en, et, sv, fi UI strings in website layer, mirroring mobile keys without importing them.                                                                                           | ☐      |
| WB-07 | Verify: `bun run typecheck && bun run lint && bun run test && bun run build`.                                                                                                                           | ☐      |

## WB1. User onboarding

DESIGN W01–W05, W13 | SPEC §7.1 | FEATURE WF1

| ID    | Task                                                                                                                                                                                | Status |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WB-11 | Sign in W01: reuse `/login` with NextAuth customer branch WB-03. Show unverified email message with resend link. Route to `/setup` if user lacks setup, otherwise route to `/`.     | ☐      |
| WB-12 | Register W02: reuse `/register` and `/api/v1/auth/signup`. Show check your email state on success.                                                                                  | ☐      |
| WB-13 | Verify email W03: `/verify-email` success and error states with resend link.                                                                                                        | ☐      |
| WB-14 | Forgot and reset password W04: reuse `/forgot-password` and `/reset-password` with soft success to stop account enumeration. Reset directs user to sign in.                         | ☐      |
| WB-15 | Setup W05: `/setup` flow with en, et, sv, fi language cards, main church search from approved churches, and extra church follows. Finish routes to `/`. Reachable later in profile. | ☐      |
| WB-16 | Profile W13: view and edit name, locale, main church, and follows. Upload profile picture via avatar path. Includes sign out.                                                       | ☐      |
| WB-17 | Tests: register, verify, and sign-in end to end. Unverified users blocked. Verify reset flow, setup persistence, and transactional single `is_main` rule.                           | ☐      |
| WB-18 | Backend contracts: verify `registerUser` returns customer with `role_id = null`. Verify `getMe` and `patchMe` support main church, locale, and picture.                             | ☐      |

## WB2. Church directory

DESIGN W07–W08 | SPEC §7.2, §5.3, §6.2 | FEATURE WF2

| ID     | Task                                                                                                                                                                                                                                 | Status |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| WB-21  | Directory screen W07: church discovery with responsive split layout, congregation cards, SVG sanctuary map, and search filter bar.                                                                                                   | ✔     |
| WB-21a | Directory API query contract: extend `MobileChurchListQuerySchema` and `LIST_PUBLIC_CHURCHES` with `radius_km`, lat, lng, `denomination`, `language`, and flags: `sunday_live_stream`, `open_now`, `taize_chants`, `youth_ministry`. | ✔     |
| WB-21b | Directory UI filter controls: wire filter controls in `ContentsSiteChurchDirectory` for distance, denomination, language, and quick-filter chips to live query state. Trigger API fetches on change.                                 | ✔     |
| WB-22  | Church profile W08: `getPublicChurch` returns cover URL via `coverUrl`, description, address, contacts, website, languages, accessibility, and service times in local church wall-clock time.                                        | ☐      |
| WB-23  | Entry points: church profile links to View prayers WB3 and Donate WB4.                                                                                                                                                               | ☐      |
| WB-24  | Tests: suspended or archived church never returns, no private field exposure, service time localized to church wall clock.                                                                                                           | ☐      |
| WB-25  | Filter tests: query by search, radius, denomination, language, and quick-filter flags individually and combined. Verify multi-filter intersections and empty filter states.                                                          | ✔     |

## WB3. Prayer

DESIGN W06, W09–W10 | SPEC §7.3 | FEATURE WF3

| ID    | Task                                                                                                                                                  | Status |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WB-31 | Home W06: `getHome` projection returns main and followed churches with latest published prayers, greeting, and empty state linking to directory.      | ☐      |
| WB-32 | Prayer list and archive W09: `/churches/:churchId/prayers` and `/prayers` via `listPublishedPrayers` using pagination contract.                       | ☐      |
| WB-33 | Prayer detail W10: title, church and pastor attribution, introduction, full body, text width, and accessibility controls.                             | ☐      |
| WB-34 | Audio player: build playback URL from approved audio asset via `S3_PUBLIC_URL` using public bucket D13. Show text only when no approved audio exists. | ☐      |
| WB-35 | Tests: draft or unapproved prayer never appears. Approved audio shows player. Missing audio shows text only. Public URL plays without auth header.    | ☐      |

## WB4. Donations, website UI

DESIGN W11–W12 | SPEC §7.4, §6.2 | FEATURE WF4

The Stripe backend is planned in admin docs as a shared capability. The website
must not rebuild it. It reuses the shared donation controller owned by the
backend. See the shared backend table below for admin task IDs.

| ID    | Task                                                                                                                                                                                                             | Status      |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| WB-40 | Website donation integration: server route handler calls shared backend donation controller from MB-02 with NextAuth session user, starts checkout, and tracks idempotency key. No new Stripe code in website.   | 🔒 MB-02    |
| WB-41 | Donate screen W11: one-time and monthly toggle, preset and custom amount, currency shown from shared `DonationOptions` MB-03. Disabled with not-ready message while backend donation launch remains unavailable. | 🔒 MB-02/03 |
| WB-42 | Result page W12: confirmed, pending, or failed status from recorded donation attempt MB-02 outcome, never from URL alone. Shows summary for church, amount, currency, and type.                                  | 🔒 MB-02    |
| WB-43 | Donation hooks: initiate and status query hooks via TanStack Query, idempotency key on initiate.                                                                                                                 | ☐           |
| WB-44 | Tests: donate button disabled when backend unavailable, initiate is idempotent, result reflects confirmed state, no fabricated success. UI tests only, backend Stripe tests live in DO-08.                       | ☐           |

Status note: MB-02 and MB-03 are pending in `docs/TASK.md`. WB4 remains blocked
until those land. When they do, mark WB4 unblocked. Do not re-plan the backend.

## Shared backend reuse, do not rebuild in website

The donation backend lives in the admin plan. Website tasks reference these
IDs instead of creating new ones:

| Admin task in docs/TASK.md | Delivers for website                                                       | Website task using it  |
| -------------------------- | -------------------------------------------------------------------------- | ---------------------- |
| DO-02, F8DO                | Stripe and donation providers, controllers, and webhook route shell        | WB-40                  |
| DO-05, F8DO                | Stripe webhook signature verification, durable receipt, and outbox         | WB-42, confirmed state |
| DO-06, F8DO                | `payment.sync` event deduplication, reconciliation, and donation upserts   | WB-42, confirmed state |
| DO-08, F8DO                | Backend Stripe tests for duplicates, out-of-order events, and installments | WB-44, UI tests only   |
| MB-02, X-MOB               | `POST M/churches/:churchId/donations` and attempt status                   | WB-40, WB-42           |
| MB-03, X-MOB               | `DonationOptions` on public church for currencies, presets, monthly flag   | WB-41                  |

Conventions: backend owns API contract. If shared donation controller needs a
website-specific launch shape, website maps it. Never force a backend rename.
Do not create `WN-*` tasks. These shared items live in `docs/TASK.md`.

## Suggested build order

1. WB-FND, WB-01 through WB-07: foundation and customer auth, unblocks remaining work.
2. WB1 Onboarding: requires WB-03 and WB-04.
3. WB2 Directory and WB3 Prayer: independent, build together while reusing public controllers.
4. WB4 Donations: website UI only, blocked on shared backend MB-02 and MB-03. Build UI once those land. No website-side Stripe work.
5. WB-06 i18n across features as they land: en first, then et, sv, fi.

## Open decisions, blocking

| Ref | Question                                                                        | Blocks                       |
| --- | ------------------------------------------------------------------------------- | ---------------------------- |
| W1  | Customer NextAuth branch: role-less session versus `prayer_user` role on signup | WB-03, WB-11, all onboarding |
| W2  | Donation payment model, currencies, presets, monthly, linking to admin D6       | MB-03, WB-41                 |
| W3  | Stripe Connect per-church account onboarding, fees, and success or cancel URLs  | MB-02 backend, WB-40         |
| W4  | Prayer language filtering at launch                                             | WB-31, WB-32                 |
| W5  | Website privacy notice and legal text                                           | WB-12 registration           |

## Deployment and release

- Website ships in same Next.js deployment as admin app. Add customer-facing
  domain in shared Vercel domain settings.
- Enable `STRIPE_ENABLED` only after shared backend donations pass end to end
  in admin tasks DO-02, DO-05, DO-06, DO-08, MB-02, and MB-03.
- Handover: reuse admin repo runbook and env names. Add website env vars for
  Stripe key, signing secret, and public base URL.

## Definition of done

- All WB-FND, WB1, WB2, and WB3 rows complete. WB4 rows complete or deferred
  with donate button disabled until shared backend MB-02 and MB-03 land.
- `bun run typecheck && bun run lint && bun run test && bun run build` passes.
- Verified flow: customer registers, verifies email, signs in, selects
  language and main church, reads or listens to prayer, and donates one-time
  or monthly. Webhook-created donation must appear in admin dashboard.
- en, et, sv, fi strings present, no guest content, and website users cannot
  access admin routes.

## Summary

Foundation requires customer NextAuth authentication and website session guard.
Onboarding, directory, and prayer reuse existing backend controllers. Donations
are website UI only because Stripe backend lives in admin tasks DO-02, DO-05,
DO-06, DO-08, MB-02, and MB-03. Schema needs only `sv` language seed.
