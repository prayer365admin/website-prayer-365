# WB1 Issue Report — Stakeholder Answers and Spec Alignment

| Item              | Value                                                                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document          | WB1-ANSWERS — answers to `docs/website/REPORT/WB1.md` (R-01 … R-15)                                                                                                                                  |
| Version           | 1.0                                                                                                                                                                                                  |
| Date              | 14 October 2026                                                                                                                                                                                      |
| Author            | [TBD]                                                                                                                                                                                                |
| Approver          | [TBD]                                                                                                                                                                                                |
| Source of answers | Stakeholder decisions, 14 October 2026                                                                                                                                                               |
| Documents checked | `docs/admin/SPEC.md`, `docs/website/SPEC.md`, `docs/website/TASK.md`, `docs/website/FEATURE.md`, `docs/website/DESIGN.md`, sibling `prayer-365-mobile-app/docs/SPEC.md`, and the current source code |

This document answers each item in the WB1 report, states how the answer lines up with the
admin, website and mobile specifications, and lists the follow-up work. Where an answer
conflicts with a specification, the conflict is called out and the required document change
is listed in section 3.

Call-outs: `ADMIN` = `docs/admin/SPEC.md`, `WEB` = `docs/website/SPEC.md`,
`MOBILE` = `prayer-365-mobile-app/docs/SPEC.md`.

---

## 1. Answers at a glance

| #    | Answer (short)                                              | Aligned with                                    | Status after this answer              | Next step / owner                                         |
| ---- | ----------------------------------------------------------- | ----------------------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| R-01 | Only staff may enter the admin dashboard.                   | ADMIN §3.2/§3.3, WEB §10                        | Accepted; needs one guard fix (small) | BE+FE ticket: staff-only dashboard guard                  |
| R-02 | Staff is staff, customer is customer; one email = one role. | ADMIN §3.2/§3.6, §7 users API, MOBILE §4.1/§7.2 | Accepted; needs one controller rule   | BE ticket: assignment must not sit on a customer          |
| R-03 | Backend is already in ADMIN §5.3 + MOBILE §5.5/§6.2.        | ADMIN §5.3, §3.4, D9; MOBILE §5.5, §6.2, F12    | Closed for WB1 (UI-only stays)        | Product: approve the two checkbox types / channel         |
| R-04 | Email + password only now. Google + Apple later.            | ADMIN §3.1 + D1, MOBILE §4.1 (M2), §12          | Closed for WB1                        | FE: hide the three non-working controls (design sign-off) |
| R-05 | Hardcoded side-panel content is fine (WB1).                 | WEB DESIGN "States", WEB FEATURE scope          | Closed for WB1                        | Launch ticket: replace or remove fabricated totals        |
| R-06 | Locale and main church are chosen after signup.             | MOBILE §3/§7.2 (F2), §5.4/5.5, WEB §4 (W05)     | Conflicts with current signup code    | BE ticket: `locale` optional, default `en`                |
| R-07 | Mobile is the reference; align the website route.           | MOBILE §6.2, ADMIN §5.1, WEB §5.1               | Accepted; needs a schema change       | BE ticket: website patch may clear main church            |
| R-08 | Skip for now.                                               | WEB W5 (open), ADMIN D10                        | Deferred, kept open                   | Legal/content review before public launch                 |
| R-09 | Already a deploy requirement in ADMIN §3.3/§3.6.            | ADMIN §3.3, §3.6                                | Closed; runbook item                  | Ops: add seed step to runbook/handover                    |
| R-10 | No worries — accepted.                                      | ADMIN §2 (UI row), WEB DESIGN (tokens)          | Closed, no ticket                     | Optional note in WEB DESIGN                               |
| R-11 | Photo used as provided (hardcoded content fine).            | WEB DESIGN (asset)                              | Closed for WB1                        | Content: clean photo if the client wants one later        |
| R-12 | Yes — a customer may have no main church.                   | MOBILE §7.2 (F2) + M4, WEB §7 (WF1)             | Accepted; resolves "skip main church" | WEB: skippable `/setup`, Home empty state, profile later  |
| R-13 | AI / Google Translate first, native review later.           | ADMIN §5.1, MOBILE M9/F13 (content only)        | Closed for WB1                        | Content: native review before public launch               |
| R-14 | Built gaps need sign-off; ask the Tech Lead per screen.     | WEB DESIGN (W01–W13)                            | Closed for WB1; sign-off pending      | Tech Lead: design sign-off checklist                      |
| R-15 | Skip for now.                                               | WEB §2.1 (shared app)                           | Deferred, kept open                   | Optional performance ticket later                         |

---

## 2. Item-by-item answers

### R-01 — `prayer_user` customers can enter the admin dashboard

**Answer.** Only staff may enter the admin dashboard. A customer account (`prayer_user`,
or a customer with no role) must never render the admin shell or reach admin screens.
Customers keep the `prayer_user` role from signup — that part of WB1 stays.

**Alignment.**

- ADMIN §3.3: `prayer_user` is the "End-user / mobile customer role. No admin grants by
  default" — it is not a staff role.
- ADMIN §3.6 step 5: a user with `role_id` null has no admin access; step 4 makes
  `User.role_id` the authoritative identity binding. A dashboard that opens for a
  no-grant role contradicts both.
- WEB §10 verification row: "Permissions — Website users cannot reach admin routes/screens."
  That row is only true once the guard blocks customers.
- MOBILE §4.4: staff/admin APIs are not part of the mobile app, and a church relationship
  is never proof of administrative permission.
- Decision W1 (WEB §3, §13) is marked "Open — needs a customer branch". WB1 already ships
  Option B (assign `prayer_user` on signup), so W1 must be recorded as resolved = Option B.

**Current code (verified).** `src/app/dashboard/layout.tsx` blocks only a session with no
role (`if (!session.user.role) redirect('/')`), so a `prayer_user` session passes and sees
an empty admin shell. Both `/login` and `/admin/login` use `components/auth/sign-in-form`
(NextAuth, `src/auth.ts`), where `customerAuthorize` allows a role-less customer session by
design. The legacy JSON route `src/app/api/v1/auth/login/route.ts` still rejects role-less
users and has no caller in `src/`.

**Follow-up work.**

| #   | Work                                                                                                                                                                         | Where                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Dashboard guard: block `prayer_user` as well (redirect to `/`), via one shared helper so the rule lives in a single place.                                                   | `src/app/dashboard/layout.tsx`                        |
| 2   | Keep `/admin/login` as the staff page. A customer who signs in there is rejected by the guard and sent to `/`; optionally show "Customers sign in at /login".                | `src/app/admin/login`, `components/auth/sign-in-form` |
| 3   | Decide the fate of the unused `POST /api/v1/auth/login`: keep it staff-only (reject role-less **and** `prayer_user`) or delete it. Do not leave a second, weaker login path. | `src/app/api/v1/auth/login`                           |
| 4   | Tests: `prayer_user` cannot reach `/dashboard`; role-less cannot; staff still can.                                                                                           | frontend tests                                        |
| 5   | Update W1 to "Resolved — Option B" and keep the §10 permissions row.                                                                                                         | WEB §3, §13                                           |

**Owner.** BE + FE (WB-FND follow-up). **Priority.** High.

---

### R-02 — Staff with only a role assignment are treated as customers

**Answer.** This is accepted as designed: a staff account is staff, a customer account is a
customer, and one email has exactly one role. Adding a church/region assignment must not
turn a customer into staff by accident — staff accounts are created (or promoted) through
user management, which sets the single `User.role_id`.

**Alignment.**

- ADMIN §3.2 Layer 1: "User has exactly one Role via `User.role_id`", and `role_id` is
  nullable only for customers with no admin role.
- ADMIN §3.3 / §3.6 step 2–4: staff have a seeded role **and** `role_assignments`; §3.6
  step 3 states "End-users/customers keep `role_id` null (no admin role) and no
  assignments".
- ADMIN §7: staff are created through `POST /api/v1/users` / `PUT /api/v1/users/:id`
  (allowlisted fields, single `role_id`); `POST A/central/role-assignments` is the tenancy
  layer only. §7 also says "users with role_id null are end-users/customers".
- MOBILE §4.1: "Registration without accepting role, permission, staff-assignment or
  arbitrary user-ID fields" — mobile signup can never create staff.
- MOBILE §7.2 F2: "Do not create role assignments on signup."

**Current code (verified).** `createRoleAssignment` (`src/controller/role-assignment.tsx`)
validates the role, org node, duplicate and the actor's escalation ceiling, then writes only
the assignment row + audit log. It never checks or updates the target user's `User.role_id`,
so a customer who receives an assignment stays a customer.

**Follow-up work.**

| #   | Work                                                                                                                                                                                                                             | Where                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | Refuse an assignment when the target user has `role_id` null or `prayer_user`: return a clear error such as `USER_IS_CUSTOMER` telling the admin to promote the user first (one email = one role, stays explicit and auditable). | `src/controller/role-assignment.tsx` |
| 2   | Staff creation / promotion stays in user management: set the single `role_id` there, then add assignments.                                                                                                                       | user management screens (admin)      |
| 3   | Keep `/register` customer-only. WB1 removed the plain staff register screen, so there is no staff self-registration; that matches ADMIN §7 and §3.6.                                                                             | WEB `/register`                      |
| 4   | Add an admin invite / create-staff flow if staff onboarding is needed in the dashboard.                                                                                                                                          | admin ticket (owner: admin team)     |
| 5   | Tests: assignment on a customer is refused and changes nothing; assignment on an existing staff user still works.                                                                                                                | backend tests                        |

**Owner.** BE (role assignment) + admin team (staff creation). **Priority.** Medium.

---

### R-03 — Notification preferences have no backend

**Answer.** Check `docs/admin/SPEC.md` — the backend **is** specified there; the gap is
narrower than the report says. What is missing is an approved preference **type and
delivery channel** for the two website checkboxes, not a whole backend design.
For WB1 the checkboxes stay UI-only (values are not sent or stored). This is accepted.

**Alignment.**

- ADMIN §5.3 defines the storage: `notification_preferences` (`user_id`, `type`, `enabled`;
  composite PK; a missing donation-reminder preference means false), `notification_rules`
  (`type` unique, `enabled`, `offset_minutes`) and `notification_deliveries` (rule + user +
  device, dedupe by event key, no delivery dashboard).
- ADMIN §3.4 permission subject `prayer_notification_rule` (read/update) and the admin
  config route `GET / PUT A/central/notification-rules` — central notification settings
  only, "no arbitrary audiences or general scheduling".
- ADMIN D9 (notification trigger timing) is still open.
- MOBILE §5.5 `NotificationType`, §6.2 `GET/PUT M/me/notification-preferences` and F12 give
  the customer-facing contract and the allowed type list: `daily_prayer`, `sunday_service`,
  `church_event`, `church_announcement`, `platform_information`, `donation_reminder`.
- WEB FEATURE "Out of scope": push notifications and device registration are out of website
  scope, so a website checkbox cannot promise push today.

**Conflict to resolve (product decision, not code).**

| Website checkbox                             | Matching spec type       | Issue                                             |
| -------------------------------------------- | ------------------------ | ------------------------------------------------- |
| "Daily Morning Devotional Scripture" (06:30) | `daily_prayer` (closest) | Timing/sender not defined; ADMIN D9 open.         |
| "Parish Urgent Prayer Alerts"                | none                     | No such type exists in ADMIN §5.3 or MOBILE §5.5. |

**Follow-up work.**

| #   | Work                                                                                                                                                                             | Owner               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | Either map the first checkbox to `daily_prayer` and drop/replace the second, **or** agree a new notification type and add it to ADMIN §5.3 + MOBILE §5.5 (spec + mobile change). | Product + Tech Lead |
| 2   | Decide the delivery channel and sender for the 06:30 message (email, push, or both) and the timezone (user locale vs church wall clock) — ADMIN D9.                              | Product             |
| 3   | Add the GDPR consent record when the preference is actually stored (ADMIN D10, MOBILE M9).                                                                                       | Backend + legal     |
| 4   | Keep "UI only, values discarded" in WB1 until 1–3 are decided.                                                                                                                   | —                   |

**Owner.** Product decision. **Priority.** Medium (no WB1 blocker).

---

### R-04 — Alternative sign-in methods have no backend

**Answer.** Confirmed: **email + password only** for the mobile app, the admin dashboard
and the website. Deferred: Member ID login, "Keep me signed in", ChurchID (EELK) and
Passwordless Magic Link. Google and Apple sign-in are planned for a later phase.

**Alignment.**

- ADMIN §3.1 is exactly this: keep NextAuth **credentials** authentication with JWT
  sessions; "a managed identity provider is no longer the default proposal for admin".
  D1 keeps the admin hardening items open.
- MOBILE §4.1: "Do not assume NextAuth cookies/JWTs are a mobile bearer contract", and M2
  is the mobile identity decision; §12 boundary says explicitly: "No automatic
  social/biometric login or second password database". §6.2 warns: "Do not publish both
  designs without a decision."
- So Google + Apple sign-in is a **new identity-provider decision** for both ADMIN (D1) and
  MOBILE (M2), not a small add-on.

**Note for the later phase.** Because one email has exactly one role (R-02), a Google/Apple
account with an existing email must link to the **same** single account — a social sign-in
must never create a second account or a second role for one email.

**Follow-up work.**

| #   | Work                                                                                                                                                                                                                                            | Owner                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | Hide or remove the three non-working controls: "ChurchID (EELK)", "Passwordless Magic Link" and the "Keep me signed in" checkbox (NextAuth JWT sessions already last 30 days, so the checkbox currently promises behaviour it does not change). | FE + design sign-off |
| 2   | Keep the sign-in field label as email (or rename the design copy) so it matches the real credential.                                                                                                                                            | FE + design          |
| 3   | Ticket for the later phase: Google + Apple providers, account linking, and the ADMIN D1 / MOBILE M2 spec updates.                                                                                                                               | Backend + mobile     |

**Owner.** FE (now) / backend + mobile (later phase). **Priority.** Medium.

---

### R-05 — Hardcoded stats and live stream in auth side panels

**Answer.** Fine for WB1 — the side-panel content stays hardcoded as designed. No backend
work now.

**Alignment and caution.**

- WEB DESIGN "States" says: "A loading placeholder; do not show fabricated totals or
  content." The rule is written for loading states, but these panels do show fabricated
  totals on a public page, so before the site is public the numbers must become real or be
  removed. That is already recorded in the WB1 report.
- WEB FEATURE lists live audio and push as out of website scope, so the "Live sanctuary
  stream" card and the evening player describe a feature that does not exist yet.
- WEB §6.1 has no public count endpoint; public counts would need an approved aggregate
  endpoint (ADMIN §7), which is new scope.
- The report cites "decision F2". No document in `docs/website/` or `.hermes/plans/` defines
  F2, so please confirm where F2 is recorded (design review notes?) and link it.

**Follow-up work.** Launch ticket: replace the fabricated totals with real data or remove
them, and reword/remove the live-stream card (owner: content + design, before public
launch). No WB1 change.

**Owner.** Content/design. **Priority.** Low now, launch blocker later.

---

### R-06 — Mobile signup breaks: locale now required

**Answer.** Confirmed: **locale and main church are chosen after signup**, not during it.
Signup collects name, email and password (with confirm) only. This applies to all three
clients, so the current strict backend signup is the part that must change.

**Alignment — current code conflicts with all three specs.**

- MOBILE §3 screen map: `LanguageSelection` and `ChurchSelection` are **onboarding screens
  after** account creation.
- MOBILE §7.2 F2: "Register/login using the chosen mobile protocol, store locale choice,
  then offer optional location/manual discovery and main-church selection."
- MOBILE §5.5 `ProfileUpdate` allows `locale` and `mainChurchId` via `PATCH M/me`, and the
  mobile signup body is only `full_name`, `email`, `password`, `confirm_password`
  (verified in `src/features/auth/types.ts`).
- WEB §4: `/setup` (W05) patches locale + main/follow **after** `/register`; WF1 step 4 is
  "`/setup` → set `locale`, main church, follows".
- Current backend `registerUser` (`src/controller/auth.tsx`) rejects a missing/invalid
  locale with 400 `INVALID_LOCALE`. That is stricter than every spec above.

**Decision.** Make `locale` optional at signup and default it to `en` (the documented
fallback direction in MOBILE M9) when the client does not send one; the client then sets the
real locale during onboarding (`PATCH M/me` for mobile, `/setup` → `PATCH /api/v1/site/me`
for the website). Keep `main_church_id` optional. The website can keep sending its chosen
locale — the field simply stops being mandatory.

**Follow-up work.**

| #   | Work                                                                                                                                                                            | Owner   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | `POST /api/v1/auth/signup`: `locale` optional, default `en`; keep `INVALID_LOCALE` for a supplied-but-invalid value and `INVALID_MAIN_CHURCH` for an unknown/unapproved church. | BE      |
| 2   | Update the signup DTO/tests and the website sign-up call (it may keep sending locale).                                                                                          | BE + FE |
| 3   | Mobile needs **no** change once the default exists — its 4-field body then succeeds. Map the two error codes only if it sends the optional fields.                              | Mobile  |
| 4   | Record the rule in ADMIN §8 (auth) and WEB §3/§4, then downgrade R-06 in the WB1 report to "resolved by backend default".                                                       | Docs    |

**Owner.** BE. **Priority.** High (it currently blocks mobile signup).

---

### R-07 — Main church / locale rules differ between website and mobile `PATCH me`

**Answer.** Mobile `PATCH /api/v1/mobile/me` is the reference behaviour. The website route
must allow clearing the main church, and locale and main church are set after signup
(see R-06).

**Alignment.**

- WEB §5.1 wants the interface language to be one of the site locales, and §9 keeps the
  interface language independent of the church country.
- ADMIN §5.1 `languages`: BCP-47 identifiers, seeded (`en`, `et`, `fi`, plus `sv` for the
  website), "No automatic translations". A locale should therefore be validated against
  that registry rather than "any string up to 10 characters".
- MOBILE §6.2: `PATCH M/me` accepts `name`, `locale`, `mainChurchId`, `profilePicture`;
  §5.5 `ProfileUpdate` marks `locale` and `mainChurchId` optional, and clearing the main
  church follows from R-12 (main church is optional).

**Current code (verified).** `SiteMePatchSchema` (`src/models/mobile.tsx`) builds on
`MobileMePatchSchema` but narrows it: `locale` must be a site locale and neither `locale`
nor `mainChurchId` may be `null`. That still reflects the old "main church is required"
rule and blocks the R-12 behaviour. Mobile's schema accepts `locale: null`, any string up to
10 characters, and `mainChurchId: null`.

**Follow-up work.**

| #   | Work                                                                                                                                                                                                                                                                                                                                                              | Owner       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Allow `mainChurchId: null` in `SiteMePatchSchema` (clear the main church), matching R-12 and mobile.                                                                                                                                                                                                                                                              | BE          |
| 2   | Flag for Tech Lead: mobile still accepts a null/unknown locale, which can never be rendered. Recommendation: both patch routes validate `locale` against the enabled `languages` rows (`en`, `et`, `sv`, `fi`) and keep the customer's language set (not clearable), since MOBILE §5.4 requires `locale` in the user DTO and WEB §5.1 needs it for the interface. | BE + mobile |
| 3   | Backfill existing users with no locale to `en` (users created before WB1 and by seeds) and make the seed set `en`.                                                                                                                                                                                                                                                | BE (data)   |
| 4   | Update WEB §5.1 and remove the "cannot be cleared" wording in the model comment.                                                                                                                                                                                                                                                                                  | Docs        |

**Owner.** BE. **Priority.** Medium.

---

### R-08 — False "zero-knowledge encryption" claim in auth copy

**Answer.** Skipped for now. The copy ships as designed in en/et/sv/fi (keys `sealBody`,
`privacyNote`).

**Alignment.** WEB W5 (privacy notice / legal text) is still open, and ADMIN D10 covers
privacy, retention and deletion. The claim describes 256-bit zero-knowledge encryption
(for prayer intentions, confessions and journals) that no part of the platform implements,
and the website has no confessions or journal feature.

**Follow-up work.** Keep open as a **launch blocker**: replace the claim with an accurate
statement in all four languages and link it to the website privacy notice once W5 is
decided (owner: client/legal + content). No WB1 change.

**Owner.** Client/legal + content. **Priority.** High before public launch.

---

### R-09 — Deploy prerequisite: `prayer_user` role must be seeded

**Answer.** Check `docs/admin/SPEC.md` — seeding is already a stated deployment
requirement there, so the loud 500 `CUSTOMER_ROLE_MISSING` is intended behaviour, not a
bug. Keep it.

**Alignment.**

- ADMIN §3.3 seeds the role templates, including `prayer_user` as a SYSTEM role with no
  grants (matching `prisma/seeds/prayer-roles.ts`, "END-USER (mobile customer) — no admin
  grants by default").
- ADMIN §3.6 step 2: "Seed the Prayer role templates, fixed Prayer permission records, and
  the full per-entity CRUD × OWN/ANY permission catalogue."
- ADMIN §3.6 (fresh database): "apply template migrations + extension migrations and seed
  explicit grants" — seeding is part of bringing an environment up.

**Follow-up work.**

| #   | Work                                                                                                                           | Owner           |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| 1   | Add the seed step (`prisma/seeds/prayer-roles.ts`, plus the `sv` language row) to the deployment runbook / handover checklist. | Ops / Tech Lead |
| 2   | Confirm staging and production are seeded **before** WB1 is released.                                                          | Ops             |

**Owner.** Ops. **Priority.** High (release gate).

---

### R-10 — Website styles changed some admin screens

**Answer.** No worries — accepted. The admin follows the shared website values: the global
`p { margin: 0; font-size: 16px }` rule, `gray-100` #F9FAFB and `blue-800` #0B4497.

**Alignment.** ADMIN §2 lists the shared UI shell/tokens and does not fix these values, so
nothing in the admin specification is broken by the change. WEB DESIGN owns the website
tokens, and they live in shared global files.

**Follow-up work.** Close R-10 with no ticket. Recommended one-line note in WEB DESIGN that
the tokens and the base `p` rule are shared with the admin and the admin impact is accepted
(so the next person does not re-open it). If the client later wants the admin untouched,
the change is to scope the `p` rule under a website wrapper class and rename the two tokens.

**Owner.** FE. **Priority.** Closed.

---

### R-11 — Sign-up banner photo has a mock form baked into the image

**Answer.** Fine for WB1 — the provided photo is used as it is (hardcoded content is
accepted, same as R-05).

**Alignment.** This is a content asset, not a spec item; WEB DESIGN defines the slot
(440 × 128 px, 2x = 880 × 256 px) and the photo is used as provided.

**Follow-up work.** Optional later: a clean St. John's Church (Jaani kirik, Tallinn) photo
at ≥ 880 × 256 px, and delete the unused `public/images/sanctuary-banner.png` (4 MB
cleanup). Owner: content/design. **Priority.** Low.

---

### R-12 — Customers can have no main church (now optional)

**Answer.** Yes, correct: a customer may finish signup without a main church and may stay
that way until they choose one later in the profile / settings.

**Alignment.**

- MOBILE §7.2 F2: "If skipping main church is approved, readiness must support that instead
  of repeatedly forcing selection."
- MOBILE M4 (decision register) still lists "main-church skip/change/unfollow rules" as
  open — this answer resolves the **skip** part: skipping is approved. The mobile document
  should record it (that file lives in the mobile repository).
- ADMIN §5.1 `user_churches` (composite PK, `is_main`, `is_followed`, partial unique index
  on `is_main`) already allows zero or one main church — no schema change needed.
- WEB §7 WF1 and TASK WB-15 (`/setup` → choose main church) must become skippable, and
  WEB DESIGN "Empty" states apply to the Home feed when nothing is followed.

**Follow-up work.**

| #   | Work                                                                                                                  | Owner        |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | `/setup` (W05) can be skipped; the customer reaches `/` with no main church.                                          | FE (WEB)     |
| 2   | Home feed (WB3, `getHome`): empty state that points to the church directory when there is no main or followed church. | FE (WEB)     |
| 3   | Profile (WB-16): choose a main church later, and clear it (ties to R-07).                                             | FE (WEB)     |
| 4   | Record "skip main church approved" in MOBILE M4.                                                                      | Mobile owner |
| 5   | Audit other features that assume a main church exists.                                                                | BE + FE      |

**Owner.** FE (website) + mobile owner for the M4 record. **Priority.** Medium.

---

### R-13 — et/sv/fi translations need native-speaker review

**Answer.** Use AI / Google Translate for now; native-speaker review comes later and will be
discussed with the client.

**Alignment.**

- ADMIN §5.1 says "No automatic translations" for the `languages` registry, MOBILE M9 lists
  "no automatic translation", and MOBILE F13 says "Do not silently translate event content
  when switching interface locale". Those rules target **content** (prayers, events,
  announcements): content must never be machine-translated or invented.
- Machine-drafted **interface strings** (buttons, labels, error messages) are not covered by
  those rules and are acceptable as an interim step.

**Follow-up work.** Mark the drafted et/sv/fi UI strings as "draft — not reviewed" so they
cannot silently become the launch text, and keep a content ticket for native review of
Estonian, Swedish and Finnish before the site is public (owner: content, client-funded).
The faith-specific terms (`osadus`, `gemenskap`, `yhteys`, `pühamu`) are the highest risk.
No WB1 change.

**Owner.** Content. **Priority.** Medium (launch gate).

---

### R-14 — Design gaps decided during build

**Answer.** The built gaps need sign-off. If a specific screen is not certain, the Tech Lead
must be told about that screen.

**Alignment.** WEB DESIGN defines screens W01–W13. The R-14 items were built without a
design or differ from it (success screen, added Back button, phone layout, W03/W04/W13 card
style reuse, background shapes), so each needs a design decision recorded in DESIGN.md
before the workstream is called done (WEB TASK done criteria).

**Follow-up work.**

| #   | Work                                                                                                                                                         | Owner              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| 1   | Put the R-14 list into one design sign-off checklist: success screen, step-3 Back button, phone layout/button sizes, W03/W04/W13 screens, background shapes. | Tech Lead + design |
| 2   | Record each outcome in WEB DESIGN (confirm as built, or supply a design).                                                                                    | Design             |
| 3   | Escalate per screen to the Tech Lead where the design is unclear.                                                                                            | FE                 |

**Owner.** Tech Lead + design. **Priority.** Low (sign-off, not a build blocker).

---

### R-15 — Shared root providers limit website performance

**Answer.** Skipped for now — not a big concern. The website keeps the shared root
providers.

**Alignment.** WEB §2.1 deliberately runs the website inside the same Next.js app with the
shared providers, and using them is the current design. Splitting the root layout touches
the admin root layout, so it is a separate, out-of-WB1 ticket with its own regression check.

**Follow-up work.** Track as an optional performance item (Lighthouse ≈ 90 on `/login`,
mobile simulation). No change now. If it is picked up later: a public website layout that
skips providers the website does not need, plus an admin regression check.

**Owner.** FE. **Priority.** Low / deferred.

---

## 3. Specification and document updates required

| #   | Document                                             | Change needed                                                                                                                                                              | Owner        |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | `docs/website/SPEC.md` §1, §3, §13                   | W1 is **resolved: Option B** — customers are created with `prayer_user`; role-less accounts are legacy only; the admin dashboard is staff-only.                            | Docs/FE      |
| 2   | `docs/website/SPEC.md` §3, §5.1, §7 (WF1)            | `locale` is optional at signup with an `en` default; locale and main church are set after signup; main church may be skipped.                                              | Docs/BE      |
| 3   | `docs/website/SPEC.md` §5 (`SiteMePatchSchema` note) | The website patch may clear the main church (align with mobile).                                                                                                           | Docs/BE      |
| 4   | `docs/website/TASK.md` (decision table + WB-15)      | Mirror 1–3; make `/setup` skippable; add the launch-list items (fabricated totals, legal copy, native review).                                                             | Docs/FE      |
| 5   | `docs/admin/SPEC.md` §8 (auth/signup note)           | Signup accepts an optional locale (default `en`); staff promotion sets the single `role_id` (one email = one role); an assignment is never created for a customer account. | Docs/BE      |
| 6   | `docs/admin/SPEC.md` §5.3 / D9                       | Unchanged — but the website checkbox types must be approved (map to `daily_prayer` or add an agreed type) before any website preference is stored.                         | Product      |
| 7   | `prayer-365-mobile-app/docs/SPEC.md` M4              | Record "skip main church approved" (mobile repository — inform the mobile owner).                                                                                          | Mobile owner |
| 8   | `docs/website/REPORT/WB1.md`                         | Mark R-06 and R-12 as resolved by these answers; reclassify R-03/R-09 as "already specified — reference only".                                                             | Docs         |

---

## Summary

Twelve of the fifteen items are closed or accepted for WB1 as they are (R-03, R-04, R-05,
R-08, R-09, R-10, R-11, R-13, R-14, R-15 plus the accepted parts of R-01 and R-02). Four
small code changes stay: (1) the admin dashboard must block `prayer_user` (R-01), (2) an
assignment must not sit on a customer account (R-02), (3) signup must treat `locale` as
optional with an `en` default so mobile signup works again (R-06), and (4) the website
profile patch must allow clearing the main church (R-07). The items that most need a
product or legal answer are the fabricated public numbers and live-stream wording (R-05),
the notification checkbox types (R-03), the encryption claim (R-08) and the native-language
review (R-13) before the site goes public.
