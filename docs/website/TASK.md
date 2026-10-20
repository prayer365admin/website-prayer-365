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

## Legend: ✔ done · ◐ partial · ☐ pending · 🔒 blocked on shared backend MB-##/DO-## in admin docs

## WB-FND. Website foundation, do first

DESIGN W01 | SPEC §2, §3 | FEATURE WF1

| ID    | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Status |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WB-01 | Create `src/app/(site)/*` route group + shared website layout (top bar: brand, language switch en/et/sv/fi, account menu; footer).                                                                                                                                                                                                                                                                                                                                                              | ✔      |
| WB-02 | Add `src/utils/required-webauth.ts`: returns cookie session user, revalidates live user (active + `auth_version`), no role required.                                                                                                                                                                                                                                                                                                                                                            | ✔      |
| WB-03 | Add NextAuth **customer sign-in branch** (SPEC W1): allow role-less `User` to create a customer session without staff permissions. Update `src/auth.ts` `authorize` + `jwt`; add tests (role-less logs in, staff still logs in, no permission leakage).                                                                                                                                                                                                                                         | ✔      |
| WB-04 | Website route guard: all site pages except public account pages require a session; unauthenticated → `/login`.                                                                                                                                                                                                                                                                                                                                                                                  | ✔      |
| WB-05 | Add `sv` language seed (`prisma/seeds/language.ts`) + migration; expose `sv` in the language contract used by the language selector. Add `'sv'` to any website-facing language allowlist.                                                                                                                                                                                                                                                                                                       | ✔      |
| WB-06 | Website i18n scaffold: en/et/sv/fi UI strings (website layer; mirror mobile keys, not imported).                                                                                                                                                                                                                                                                                                                                                                                                | ✔      |
| WB-07 | Verify: `bun run typecheck && bun run lint && bun run test && bun run build`.                                                                                                                                                                                                                                                                                                                                                                                                                   | ✔      |
| WB-08 | Responsive header + footer (review 013): `SiteShell` variants (`general` / `auth` header, `full` / `legal-only` footer), primary nav + church picker + account menu in the top bar, parish/support/legal footer, website chrome for `/customer`, and a client `SessionAccessGuard` for back/forward-cache restores. All new chrome strings are i18n keys in en/et/sv/fi. The Pastoral Care panel shows no phone number until a verified one is set in `src/components/site/support-hotline.ts`. | ✔      |
| WB-09 | Header/footer links to `/events`, `/giving`, `/search`, `/notifications` (and footer `/privacy`, `/terms`, `/support`) stay visible while those pages are unbuilt and return 404 until WB-23/WB-40/WB-41 land — accepted at review 013, revisit when the pages ship.                                                                                                                                                                                                                            | ☐      |

## WB1. User onboarding

DESIGN W01–W05, W13 | SPEC §7.1 | FEATURE WF1

| ID    | Task                                                                                                                                                                                                                                                                                                                                          | Status |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WB-11 | Sign in (W01): `/login` + NextAuth (W1 Option B); unverified → `/verify-account` with resend; then `/` (website layout sends to `/customer/setup` until onboarding is finished).                                                                                                                                                              | ✔      |
| WB-12 | Register (W02): `/register` name + email + password → `/api/v1/auth/signup`; success "check your email" state.                                                                                                                                                                                                                                | ✔      |
| WB-13 | Verify email (W03): `/verify-email` — Confirm button (scanner-safe), success → Sign in, invalid/expired → resend form; `/verify-account` (unverified sign-in) — resend with server cooldown, prefilled email.                                                                                                                                 | ✔      |
| WB-14 | Forgot/reset (W04): sign-in card without the aside (own title/subtitle, same quote); forgot → soft-success "check your email" + cooldown countdown; reset → strength meter + confirm, "password changed" or invalid-link state → sign in / new link. Shared by customers and staff.                                                           | ✔      |
| WB-15 | Setup (W05): `/customer/setup` after first sign-in — parish (optional, search approved + frequent chips) saves on step 1; "Skip for now" saves no parish and advances; language saves on step 2, or its "Skip for now" saves English; unfinished step is resumed after reload. Later changes in Profile.                                      | ✔      |
| WB-16 | Profile (W13): `/customer` with an independent dashboard-style header/content/footer layout (no sidebar), built like the dashboard pastor edit page — picture upload (sign → S3 → save), read-only email, name, language (also sets the UI language), main church (clearable), followed churches (Form.List, follow/unfollow diff), sign out. | ✔      |
| WB-17 | Tests: register→verify→sign-in end to end, unverified blocked, reset flow, setup persistence, main-church single `is_main` (transactional). Flow suite: `src/controller/onboarding.flow.test.ts`.                                                                                                                                             | ✔      |
| WB-18 | Backend contracts: `registerUser` creates a `prayer_user` customer (locale `null` until onboarding, main church optional); `getMe`/`patchMe` support main-church (clearable) + locale + picture.                                                                                                                                              | ✔      |

### WB1-PROFILE — Routed Customer Profile

DESIGN `docs/website/design/customer-profile/*` | Owner scope update: 19 Oct 2026

| ID      | Task                                                                                                                                                                                                                                                       | Status |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WB1-P01 | Add the shared `/customer/*` profile shell beneath the existing customer header, with an additional identity/chaplain/primary-sanctuary summary, five-menu navigation, daily quietude card, sign-out action, responsive layout, and protected-route guard. | ✔     |
| WB1-P02 | Personal Profile (`/customer`): match the supplied profile design using supported fields—photo, read-only email, name, and preferred language—with real save/remove flows.                                                                                 | ✔     |
| WB1-P03 | Church Affiliations (`/customer/church-affiliations`): split main and followed church management out of Personal Profile.                                                                                                                                  | ✔     |
| WB1-P04 | Notifications (`/customer/notifications`): confirm persistence contract, then implement the design without fabricating saved preferences.                                                                                                                  | ☐      |
| WB1-P05 | Giving & Stewardship (`/customer/stewardship`): add an intentionally empty placeholder until the donation/stewardship backend is available.                                                                                                                | ☐      |
| WB1-P06 | Sacramental Privacy (`/customer/privacy`): implement supported privacy information; keep export/deletion actions unavailable until backend scope is approved.                                                                                              | ✔      |
| WB1-P07 | Add responsive and route-level tests for each profile section as it lands.                                                                                                                                                                                 | ☐      |

## WB2. Church directory

DESIGN W07–W08 | SPEC §7.2, §5.3, §6.2 | FEATURE WF2

| ID     | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Status |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WB-21  | Directory screen W07: church discovery with responsive split layout, congregation cards, Google Maps interactive map (`GOOGLE_MAPS_API`), search filter bar; API query contract (`radius_km`, lat, lng, `denomination`, `language`, quick-filter flags); UI filter controls wired to live query state.                                                                                                                                                                                                                                                                                                                                                                                                                                        | ✔      |
| WB-22  | Church profile W08: `getPublicChurch` returns cover URL via `coverUrl`, description, address, contacts, website, languages, accessibility, and service times in local church wall-clock time.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ✔      |
| WB-23  | Entry points: church profile links to View prayers WB3 and Donate WB4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | ☐      |
| WB-24  | Tests: suspended or archived church never returns, no private field exposure, service time localized to church wall clock.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | ✔      |
| WB-25  | Filter tests: query by search, radius, denomination, language, and quick-filter flags individually and combined. Verify multi-filter intersections and empty filter states.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | ✔      |
| WB-26  | Gallery schema + exposure: Prisma migration for `church_gallery_items` (church_id FK, media_asset_id FK, caption, order_index, @@index), extend `MobilePublicChurchSchema` with `gallery`, include + map in `GET_PUBLIC_CHURCH`/`mapPublicChurch` (READY + IMAGE assets only, order_index asc, S3 URL like coverUrl). Seed demo gallery rows.                                                                                                                                                                                                                                                                                                                                                                                                 | ✔      |
| WB-27  | Sanctuary hours schema + exposure: Prisma migration for `sanctuary_hours` text column on `churches` table, extend `MobilePublicChurchSchema` and `MobileChurchSummarySchema` with `sanctuaryHours` (`z.string().nullable()`), map in `GET_PUBLIC_CHURCH`/`mapPublicChurch`, seed demo sanctuary hours.                                                                                                                                                                                                                                                                                                                                                                                                                                        | ✔      |
| WB-28  | Staff exposure: extend `MobilePublicChurchSchema` with `staff` (`MobileChurchStaffSchema`: name, pastoralRole, imageUrl nullable), include active `church_pastors` + `pastor` in `GET_PUBLIC_CHURCH`, image resolution church-override → pastor image → null.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ✔      |
| WB-29  | Deanery exposure: extend `MobilePublicChurchSchema` with `deaneryName` (`z.string().nullable().optional()`), resolve parent `org_node` with `kind = 'DEANERY'` in `GET_PUBLIC_CHURCH`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | ✔      |
| WB-A30 | Site content routes: `src/app/api/v1/site/churches/[churchId]/events/route.ts` and `.../announcements/route.ts` — thin wrappers calling `listPublicEvents` / `listPublicAnnouncements` with `requiredWebAuth`, mirroring the existing `[churchId]/route.ts` pattern; route tests (401, 404, envelope).                                                                                                                                                                                                                                                                                                                                                                                                                                        | ✔      |
| WB-A31 | Site home route: `src/app/api/v1/site/home/route.ts` calling `getHome` with `requiredWebAuth`; profile page Primary Parish chip renders `t('primaryParish')` when `mainChurch.id === churchId`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ✔      |
| WB-A32 | W08 wiring: Upcoming Gatherings tiles from real events (title, `starts_at` in church timezone, `registration_url` as external 'Join Service' link, omit CTA when null); Notice Board tiles from announcements (title/body/date, no category); gallery tiles from `gallery` (first tile falls back to `coverUrl`); Pastoral Care Office staff rows from `staff` (drop hardcoded sample names) and dynamic `deaneryName` badge; Sanctuary Hours card wired to `sanctuaryHours` (fallback to 'Hours unlisted'); diaconal cards render from `diaconal_programs`; keep the epistle quote, architect caption and intercession form as documented static copy (the architect caption is placeholder text and must be replaced before public launch). | ✔      |
| WB-A33 | Tests: gallery ordered + READY-only, staff name/role/image only (no contact fields in response), events approved-church + upcoming gating, announcements published-only, sanctuary hours and deanery exposure, chip logic, suspended church 404 across all new routes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | ✔      |
| WB-A34 | Church style pill + quick-filter columns: migration `20261016120000_add_church_style` (`churches.church_style`) and `20261013153502_add_church_quick_filters` (`sunday_live_stream`, `taize_chants`, `youth_ministry`); exposed on `MobileChurchSummary.churchStyle` (directory pill) and honoured by the four quick filters; admin church-profile tabs for gallery, diaconal programs, accessibility list and sanctuary schedule blocks, plus the map picker. Admin UI is in scope from this branch on (supersedes the W6 "'Admin UI deferred'" note).                                                                                                                                                                                       | ✔      |

## WB3. Prayer

DESIGN W06, W09–W10 | SPEC §7.3 | FEATURE WF3

| ID    | Task                                                                                                                                                  | Status |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WB-31 | Home W06: `getHome` projection returns main and followed churches with latest published prayers, greeting, and empty state linking to directory.      | ✔      |
| WB-32 | Prayer list and archive W09: `/churches/:churchId/prayers` and `/prayers` via `listPublishedPrayers` using pagination contract.                       | ✔      |
| WB-33 | Prayer detail W10: title, church and pastor attribution, introduction, full body. Partial: no text width/size controls (not in design).               | ◐      |
| WB-34 | Audio player: build playback URL from approved audio asset via `S3_PUBLIC_URL` using public bucket D13. Show text only when no approved audio exists. | ✔      |
| WB-35 | Tests: draft or unapproved prayer never appears. Approved audio shows player. Missing audio shows text only. Public URL plays without auth header.    | ✔      |

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

| Ref | Question                                                                        | Blocks                 |
| --- | ------------------------------------------------------------------------------- | ---------------------- |
| W1  | **Resolved 14 Oct 2026: Option B** — `prayer_user` on signup, admin staff-only. | —                      |
| W2  | Donation payment model/currencies/presets/monthly (links admin D6).             | MB-03, WB-41           |
| W3  | Stripe Connect per-church account onboarding + fees + success/cancel URLs.      | MB-02 (backend), WB-40 |
| W4  | Prayer language filtering at launch.                                            | WB-31, WB-32           |
| W5  | Website privacy notice / legal text.                                            | WB-12 (registration)   |

## Decisions taken during WB1 (recorded 14 Oct 2026)

Decided while building WB1; answers to the WB1 issue report are in
`docs/website/REPORT/WB1-ANSWERS.md`.

| Ref | Decision                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------- |
| B1  | Signup: name, email, password only. `locale` remains `null` until onboarding; `main_church_id` is optional (R-06, R-12).     |
| B2  | Public church picker API without auth, `{id, name, city}` only; "frequent" = top 4 by followers.                             |
| B3  | Notification checkboxes (setup step 2): UI only, values not stored (R-03).                                                   |
| B4  | ChurchID (EELK), Magic Link, Member ID, "Keep me signed in": shown, no action (R-04).                                        |
| F1  | Sign-in follows the design as drawn.                                                                                         |
| F2  | Auth side-panel stats and live stream are hardcoded for WB1; replace or remove before public launch (R-05).                  |
| F3  | Setup step-2 checkboxes shown with no action.                                                                                |
| F4  | Locale and main church are onboarding (`/customer/setup`; parish optional) after the first sign-in, not part of `/register`. |

## Before public launch (from the WB1 report)

- Replace or remove the fabricated side-panel totals and the live-stream card (R-05).
- Replace the "zero-knowledge encryption" and privacy-note copy in en/et/sv/fi (R-08, W5).
- Native-speaker review of et/sv/fi UI strings (R-13), including the header/footer
  chrome keys added by review 013 (`header*`, `footer*`).
- Set a real, verified pastoral-care phone number in
  `src/components/site/support-hotline.ts` (the footer links to `/churches` while it is empty).
- Seed `prayer_user` (and the `sv` language) on every environment (R-09).
- Design sign-off for the screens built without a design (R-14).
- Replace the placeholder architect caption ("Constructed 1862–1867 / Architect Christoph August Gabler") and the "Sanctuary Keepers on Duty" chip on the church profile.
- Finalise the stewardship tax-deductibility wording (W5 legal review); it now ships as a generic pending-legal notice.

## Deployment and release

- The website ships in the same Next.js deployment as the admin (same app).
  Add a customer-facing domain in the shared Vercel/domain configuration.
- Enable `STRIPE_ENABLED` only after the shared backend donations land and pass
  end to end (admin DO-02/05/06/08, MB-02/03 — not website-side work).
- Handover: reuse the admin repo runbook/env names; add the website env vars
  (Stripe key/signing secret, public base URL).
- Release gate (R-09): every environment must be seeded with the role
  templates (`prisma/seeds/prayer-roles.ts`, incl. `prayer_user`) and the `sv`
  language row before WB1 is released; otherwise signup returns 500
  `CUSTOMER_ROLE_MISSING`. Apply migration `20261014010000_user_church_setup_completed_at`
  (onboarding progress). Locales are not backfilled: `null` means onboarding is
  not finished, so existing customers without a language go through `/customer/setup`.
- Setup flow (WB-15): a step is filled only when the user chooses a value
  (`church_setup_completed_at`, `locale_setup_completed_at`); Skip fills
  nothing (language skip still saves `en`, flagged `localeSkipped`). While a
  step is unfilled, each browser offers setup once: sign-in and `SetupGuard`
  check `GET /api/v1/site/me/setup-progress` when localStorage
  `prayer365.setupProgress.<userId>` is missing, record it, and go to
  `/customer/setup`; a browser that already asked goes to `/customer`.
  Finishing or skipping setup goes to `/customer`. Apply migration
  `20261014020000_user_locale_setup_completed_at`.

## Definition of done

- All WB-FND, WB1, WB2, and WB3 rows complete. WB4 rows complete or deferred
  with donate button disabled until shared backend MB-02 and MB-03 land.
- WB2 rows include the promoted W08 sections (gallery, staff, sanctuary hours, deanery name, events, announcements, Primary Parish chip).
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
DO-06, DO-08, MB-02, and MB-03. Schema needs `church_gallery_items` table, `sanctuary_hours` column on `churches`, and `sv` language seed.
