# PRAYER Admin — Task Breakdown (TASK.md)

Created: 28 September 2026 (restructured per-feature). Source docs: `docs/DESIGN.md`, `docs/FEATURE.md`, `docs/OVERVIEW.md`, `docs/SPEC.md`.

## How to Use

- Tasks are grouped per feature domain. Inside each feature, work top-down: Hooks → Screens → Integrations → Tests. API/DB layers are mostly complete — verify, don't redo.
- Each row is one small verifiable unit. Check off when done.
- "done" = passes verify + satisfies acceptance hint.
- Verify after any change: `bun run typecheck && bun run lint && bun run test && bun run build`.
- Cross-refs: `DESIGN S{n}` = wireframe, `SPEC §m` = spec section, `F{n}` = feature in FEATURE.md.
- Follow SPEC rules: layer architecture (app → contents → hooks → api → controller → provider), hybrid RBAC (requiredAuth + requiredScope), UPPER_SNAKE_CASE providers, no direct Prisma in routes, GeneralError for expected errors, cache keys carry userId/churchId.
- Do NOT build "Future Approach" items. Do NOT commit/push — user handles git.

Legend: ✔ done · ☐ pending

---

## F1CH — Churches (profile, overview, selector, service schedule)

DESIGN S02–S04 | SPEC §7 church URLs | FEATURE F1/F2/F3

| ID    | Task                                                                                                                                                                                | Done |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| CH-01 | DB: `churches`, `church_languages`, `org_nodes` models + seeds, migrations                                                                                                          | ✔   |
| CH-02 | API: church provider/controller/models + `A/churches`, `C/overview`, `C/profile`, `C/pastors`, `C/service-times` routes + tests                                                     | ✔   |
| CH-03 | Hooks: create `hooks/data/church.tsx` — my churches, detail, profile get/patch, overview, service-times get/put (spec §2.1 cache keys)                                              | ✔   |
| CH-04 | Screen: S02 church selector (`/dashboard/churches`) — assigned churches only, skip when single                                                                                      | ✔   |
| CH-05 | Screen: S03 church overview (`.../churches/:churchId`) — followers, today's prayer, upcoming events, recent requests (hidden without request access), donation activity, engagement | ✔   |
| CH-06 | Screen: S04 profile editor (`.../profile`) — tabs: details/cover, location+contacts, assigned pastors, languages, accessibility                                                     | ✔   |
| CH-07 | Screen: service schedule editor (S04 tab) — weekday/local time/label/language, transactional replace, stale-edit guard                                                              | ✔   |
| CH-08 | Integration: S3 cover image upload (purpose allowlist + scope + completion check)                                                                                                   | ✔   |
| CH-09 | Tests: unauthorized church edit denied, cross-church read denied, stale version conflict, profile reflected in mobile contract                                                      | ✔   |

## F2PA — Pastors (profiles, church assignments, attribution)

DESIGN S20 | SPEC §8.2/§8.3 pastor endpoints | FEATURE F3/F8

| ID    | Task                                                                                                                                       | Done |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| PA-01 | DB: `pastors`, `church_pastors` models + seeds                                                                                             | ✔   |
| PA-02 | API: pastor provider/controller/models + `A/central/pastors` CRUD, `PATCH C/pastors/:pastorId`, `PUT C/churches/:churchId/pastors` + tests | ✔   |
| PA-03 | Hooks: `hooks/data/central.tsx` pastor queries/mutations + church pastor assignment hook                                                   | ✔   |
| PA-04 | Screen: S20 pastor list + create/edit (`/dashboard/central/pastors`) — name, intro, optional linked user                                   | ✔   |
| PA-05 | Screen: church pastors tab (S04) — assign pastors, church role, image; only church-specific fields                                         | ✔   |
| PA-06 | Rule check: edit preserves historical prayer attribution; pastor biography never auto-grants staff access                                  | ✔   |
| PA-07 | Tests: profile without login stays non-admin, assignment scoping, attribution preserved on change                                          | ✔   |

## F3PR — Prayers (text, approval, audio, schedule, publish)

DESIGN S05–S07 | SPEC §9.3 | FEATURE F4

| ID    | Task                                                                                                                                                                                 | Done |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| PR-01 | DB: `prayers`, `prayer_versions`, `prayer_audio` + seeds                                                                                                                             | ✔   |
| PR-02 | API: prayer/prayer-audio providers + controllers + `C/prayers` CRUD, approve-text, audio create/status/approve, schedule, publish + tests                                            | ✔   |
| PR-03 | Hooks: `hooks/data/prayer.tsx` — list, detail, create, patch (new text version), approve-text, audio actions, schedule, publish                                                      | ✔   |
| PR-04 | Screen: S05 prayer list/archive (`.../prayers`) — current + published archive, publication info, create action                                                                       | ✔   |
| PR-05 | Screen: S06 prayer editor (`.../prayers/new`, `.../prayers/:prayerId`) — title/intro/body, assigned-pastor picker, language, read-only review before audio                           | ✔   |
| PR-06 | Screen: S07 audio review + publication (editor tab) — generate (blocked until reviewed text + ready voice), preview, approve audio, schedule, publish; disabled actions with reasons | ✔   |
| PR-07 | Integration: `audio.generate` job — recheck approval/consent/voice readiness, ElevenLabs TTS, private S3 storage, mark ready                                                         | ✔   |
| PR-08 | Integration: `prayer.publish` job — due-time revalidation, publish once, enqueue notification, survive retries/downtime                                                              | ✔   |
| PR-09 | Rules: never inherit old audio approval on new text version; stale generation never attaches to another version                                                                      | ✔   |
| PR-10 | Tests: approval tied to exact snapshot, audio private until approved, duplicate job safety, scheduled publish after restart                                                          | ✔   |

## F4VO — Voice Profiles (pastor submission, admin review, ElevenLabs IVC)

DESIGN S24/S27 | SPEC §9.3.1 | FEATURE F4/F8

| ID    | Task                                                                                                                                                                                                                            | Done |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| VO-01 | DB: `voice_profiles`, `consents`, `media_assets` + seeds                                                                                                                                                                        | ✔   |
| VO-02 | API: voice/consent/media providers + controllers + `A/me/voice-*`, `A/central/voice-profiles/*`, media upload/complete/access routes + tests                                                                                    | ✔   |
| VO-03 | Hooks: `hooks/data/voice.tsx` — consents, submissions (create/update/submit), central review list/detail/approve/reject/disable                                                                                                 | ☐    |
| VO-04 | Screen: S27 My Voice (`/dashboard/my-voice`) — sample upload + guidance (1–2 min), evidence upload/reference, Save draft, Submit; read-only after submit; rejection reason + revised submission                                 | ☐    |
| VO-05 | Screen: S24 admin review (`/dashboard/central/voice-profiles`) — list (review_state + registration_state), preview player + evidence, Approve ("Approve and register") / Reject (reason) only when pending, disable ready voice | ☐    |
| VO-06 | Screen states: Queued, Registering, Verification required, Ready, Failed, Check registration result — read-only                                                                                                                 | ☐    |
| VO-07 | Integration: `voice.register` job — checksum verify, `POST /v1/voices/add` under one PRAYER account, store voice_id + requires_verification, verification hold, reconcile ambiguous timeouts (no blind duplicate create)        | ☐    |
| VO-08 | Rules: no self-approval, no provider call pre-approval, immutable submitted revision, keep previous ready voice until replacement ready                                                                                         | ☐    |
| VO-09 | Tests: other-pastor access denied, self-approval denied, pre-approval provider call blocked, consent revocation mid-flight                                                                                                      | ☐    |

## F5EV — Events

DESIGN S08 | SPEC §9.4 | FEATURE F5

| ID    | Task                                                                                                                                           | Done |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| EV-01 | DB: `events` model + seeds                                                                                                                     | ✔   |
| EV-02 | API: event provider/controller/models + `GET/POST C/events`, `PATCH C/events/:eventId` + tests                                                 | ✔   |
| EV-03 | Hooks: `hooks/data/event.tsx` — list, create, patch                                                                                            | ✔   |
| EV-04 | Screen: S08 list + create/edit (`.../events`) — category, title, desc, startsAt (timezone shown), location, optional registrationUrl, language | ✔   |
| EV-05 | Rules: local time converted to UTC with explicit offset; registration URL stored as link only; no internal booking/recurrence                  | ✔   |
| EV-06 | Tests: DST/timezone cases, stale-version conflict, cross-church event rejected                                                                 | ✔   |

## F6AN — Announcements

DESIGN S09 | SPEC §9.4 | FEATURE F5

| ID    | Task                                                                                                                   | Done |
| ----- | ---------------------------------------------------------------------------------------------------------------------- | ---- |
| AN-01 | DB: `announcements` model + seeds                                                                                      | ✔   |
| AN-02 | API: announcement provider/controller/models + `GET/POST C/announcements`, `PATCH .../:id`, `POST .../publish` + tests | ✔   |
| AN-03 | Hooks: `hooks/data/announcement.tsx` — list, create, patch, publish                                                    | ✔   |
| AN-04 | Screen: S09 list + create/edit + publish (`.../announcements`) — minimal fields (title/body), immediate publish        | ✔   |
| AN-05 | Tests: publish permission enforced, no duplicate reminders on edit                                                     | ✔   |

## F7RQ — Requests (prayer/pastoral/meeting)

DESIGN S10–S11 | SPEC §9.5 | FEATURE F6

| ID    | Task                                                                                                                                                                      | Done |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| RQ-01 | DB: `requests` model + seeds                                                                                                                                              | ✔   |
| RQ-02 | API: request provider/controller/models + `GET C/requests` (filtered before pagination), `GET C/requests/:requestId`, mobile `POST M/churches/:churchId/requests` + tests | ✔   |
| RQ-03 | Hooks: `hooks/data/request.tsx` — list (allowed kinds), detail                                                                                                            | ☐    |
| RQ-04 | Screen: S10 request list (`.../requests`) — authorized kinds only, no content to unauthorized staff                                                                       | ☐    |
| RQ-05 | Screen: S11 request detail (`.../requests/:requestId`) — message + preferred contact method, external phone/email action, sensitive-data guard                            | ☐    |
| RQ-06 | Security: private rows filtered before count/pagination, logs/notifications never carry message/contact/classification, submission rate-limited + idempotent              | ☐    |
| RQ-07 | Tests: unauthorized detail returns nothing, duplicate submission same result, scope bypass attempts fail                                                                  | ☐    |
| RQ-08 | Note: D3 blocks anything beyond view/contact — do not invent status/assignment UI                                                                                         | ☐    |

## F8DO — Donations (reporting + Stripe)

DESIGN S12 | SPEC §9.6 | FEATURE F7

| ID    | Task                                                                                                                                                                                                                                              | Done                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| DO-01 | DB: `payment_accounts`, `donations`, `donation_subscriptions`, `webhook_receipts`, `idempotency_records` + seeds                                                                                                                                  | ✔                  |
| DO-02 | API: donation/stripe providers + controllers + `C/donations`, `C/donation-subscriptions`, `C/donation-summary`, webhook route + tests (admin ✔). **Mobile `POST M/churches/:churchId/donations` NOT built** → see Mobile contract backlog §X-MOB | ✔ admin · ☐ mobile |
| DO-03 | Hooks: `hooks/data/donation.tsx` — transactions, recurring, monthly summary                                                                                                                                                                       | ☐                   |
| DO-04 | Screen: S12 reporting (`.../donations`) — tabs: transactions, recurring, monthly summary; currencies kept separate, pending/failed states accurate                                                                                                | ☐                   |
| DO-05 | Integration: Stripe webhook — raw-body signature verify, receipt + outbox in transaction, ack after durable accept (SPEC §8.5)                                                                                                                    | ☐                   |
| DO-06 | Integration: `payment.sync` job — dedupe and reconcile out-of-order/duplicate events, upsert subscription + per-installment donations, no stale-event overwrite                                                                                   | ☐                   |
| DO-07 | Rules: subscription event ≠ paid donation; refund notices reported, not a refund UI                                                                                                                                                               | ☐                   |
| DO-08 | Tests: failed payments, duplicate/out-of-order webhooks, monthly installments, refunds, wrong connected account, redirect-before-webhook                                                                                                          | ☐                   |
| DO-09 | Note: charge model/fees/currencies = D6; backend must resolve church's verified account, never raw card data                                                                                                                                      | ☐                   |

## F9ANL — Analytics, Attendance, Regional Dashboards

DESIGN S13/S26 | SPEC §9.7 | FEATURE F9/F10

| ID     | Task                                                                                                                                                                      | Done |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| ANL-01 | DB: `check_ins`, `analytics_events` + seeds                                                                                                                               | ✔   |
| ANL-02 | API: analytics provider/controller + `C/analytics`, `C/attendance-summary`, `A/regions/:regionId/summary`, mobile check-in + analytics-events + tests                     | ✔   |
| ANL-03 | Hooks: `hooks/data/analytics.tsx` + `hooks/data/region.tsx`                                                                                                               | ☐    |
| ANL-04 | Screen: S13 church analytics (`.../analytics`) — trend chart placeholder, count-based aggregates, bounded date range, no named attendance                                 | ☐    |
| ANL-05 | Screen: S26 regional dashboard (`/dashboard/regions/:regionId`) — one layout for country/diocese/deanery; aggregate church/user/engagement/attendance/donation stats only | ☐    |
| ANL-06 | Rules: authorized descendant church set before aggregation; source records for financial/check-in counts; no private request data in metrics; no cross-currency sums      | ☐    |
| ANL-07 | Tests: scope totals correct, repeat-event dedupe, hierarchy reassignment, small-cohort privacy, bounded dates                                                             | ☐    |

## F10NO — Notifications (config + push + email)

DESIGN S25 | SPEC §9.8 | FEATURE F11

| ID    | Task                                                                                                                                                                                                                                                                     | Done                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| NO-01 | DB: `notification_rules`, `notification_preferences`, `notification_deliveries`, `device_tokens` + seeds                                                                                                                                                                 | ✔                  |
| NO-02 | API: notification provider/controller + `A/central/notification-rules` GET/PUT + tests (admin ✔). **Mobile preferences (`GET/PUT M/me/notification-preferences`) + devices (`PUT/DELETE M/me/devices/:installationId`) NOT built** → see Mobile contract backlog §X-MOB | ✔ admin · ☐ mobile |
| NO-03 | Hooks: `hooks/data/notification.tsx` — rules get/put                                                                                                                                                                                                                     | ☐                   |
| NO-04 | Screen: S25 central settings (`/dashboard/central/notifications`) — enabled switches for required types + approved timing values only; no audience/campaign UI                                                                                                           | ☐                   |
| NO-05 | Integration: `notification.send` job — recheck rule + content visibility, resolve audience, check current preferences (donation opt-in default false), dedupe event/user/device, FCM/APNs push, delivery record                                                          | ☐                   |
| NO-06 | Integration: transactional email via template Nodemailer/Handlebars with verified TLS transport                                                                                                                                                                          | ☐                   |
| NO-07 | Rules: payload never contains private request/message text; invalid tokens retired; opt-out between enqueue/send honored                                                                                                                                                 | ☐                   |
| NO-08 | Tests: opt-out respected, no duplicate sends, obsolete event reminders skipped, dedupe by event/user/device                                                                                                                                                              | ☐                   |
| NO-09 | Note: trigger timing/recipients = D9                                                                                                                                                                                                                                     | ☐                   |

## F11ORG — Central Organization (hierarchy, countries, languages)

DESIGN S21–S23 | SPEC §8.3 | FEATURE F8

| ID    | Task                                                                                                                                                       | Done |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| OR-01 | DB: `org_nodes`, `countries`, `languages`, `role_assignments` + seeds                                                                                      | ✔   |
| OR-02 | API: hierarchy/country/language/role-assignment providers + controllers + routes + tests                                                                   | ✔   |
| OR-03 | Hooks: extend `hooks/data/central.tsx` — hierarchy tree/node, countries, languages, role-assignments                                                       | ☐    |
| OR-04 | Screen: S21 hierarchy (`/dashboard/central/hierarchy`) — tree view, new-node panel (kind/name/parent), invalid-parent + cycle rejection, move confirmation | ☐    |
| OR-05 | Screen: S22 countries (`/dashboard/central/countries`) — list + create/edit/enable; no destructive removal of referenced countries                         | ☐    |
| OR-06 | Screen: S23 languages (`/dashboard/central/languages`) — list + edit/enable; block enable until translations ready                                         | ☐    |
| OR-07 | Screen: role-assignment management — grant/revoke staff church/region scope (tenancy layer), escalation guard                                              | ☐    |
| OR-08 | Tests: hierarchy cycles rejected, reassignment reporting (D8), country-role powers bounded, revoke loses access                                            | ☐    |

## F12ST — Staff, Roles, Permissions

DESIGN S17–S19 | SPEC §3, §14 | FEATURE F1/F8

| ID    | Task                                                                                                                                                                                         | Done |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| ST-01 | Foundation: template user/role/permission UI migrated to hybrid RBAC (single role_id + role_assignments tenancy), prayer role templates + full CRUD×OWN/ANY catalogue seeded                 | ✔   |
| ST-02 | API: hardened users/roles/permissions contracts — safe DTOs, no password, grant-ceiling validation, permission cache invalidation                                                            | ✔   |
| ST-03 | Audit + fix: template adoption checks (SPEC §14) — own-profile role_id escalation blocked, deleted_at filters, safe error envelopes, bypass paths (uploads/mail/PDF/role hard-delete) closed | ☐    |
| ST-04 | Screen polish: staff create/edit binds single role + assignments; password never shown; role detail shows permission editor, protects SYSTEM roles + last admin                              | ☐    |
| ST-05 | Tests: RBAC acceptance cases (SPEC §14.1) — Church A edit vs Church B read, escalation attempts fail, revoked grants lose access, caches never preserve auth                                 | ☐    |

## F13ME — My Church/Region (unchanged here; see F1CH/F9ANL)

Covered by Churches (overview/selector) and Regional dashboards. No separate module.

## X — Cross-Cutting Platform Tasks

Not feature-bound; unblocks everything.

| ID   | Task                                                                                                                                                                                                                      | Done |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| X-01 | Auth hardening (SPEC §3.1): auth_version revocation compare, active-user checks incl. Server Actions, generic login failures + rate limit, handler base-path verified                                                     | ☐    |
| X-02 | Client data layer plumbing: stable QueryClient, scope-aware keys + invalidation, logout cache clear (SPEC §2.1)                                                                                                           | ☐    |
| X-03 | Sidebar wiring: scope-aware menu for all new routes, permission-driven visibility (useAccessPermission), hide non-feature demo entries                                                                                    | ☐    |
| X-04 | Media flow (SPEC §10.4): signing hardened (purpose allowlist, size/type limits, completion validation), unattached-upload cleanup job, short-lived access URLs                                                            | ☐    |
| X-05 | Outbox dispatcher: claim ready rows, durable delivery, lease/retry/dead-letter; external worker entry (`workers/`) reusing controllers                                                                                    | ☐    |
| X-06 | i18n scaffold: en/et/fi, UI language independent of church country; extract strings from feature screens (English first)                                                                                                  | ☐    |
| X-07 | D1 mobile token contract: issue/refresh/revocation spec for RN client; never reuse admin session JWT as bearer (`/api/v1/mobile/auth/{login,refresh,logout}` + required-auth `auth_version`/active check). Done plan 002. | ✓    |
| X-08 | E2E admin flow tests: login → scope → CRUD → permission-hidden actions against staging DB                                                                                                                                 | ☐    |
| X-09 | Deploy/infra (D11): Vercel↔PostgreSQL connectivity, private S3, SQS/DLQ + EventBridge, Secrets Manager, CloudWatch alerts (job-lag, payment-sync), controlled migrations, backup/restore, production email transport     | ☐    |
| X-10 | Cleanup: remove stub pages + demo master-data (brand/color) + dead endpoints; full verify pass; accessibility basics (labels, keyboard focus, no color-only meaning, timezone on date inputs)                             | ☐    |
| X-11 | Handover package: schema, API docs, deployment/runbook, service inventory, env names (SPEC §11.3)                                                                                                                         | ☐    |

## X-MOB — Mobile Contract Backlog (backend owns these)

The built `M/` routes (`src/controller/mobile.tsx`, `src/models/mobile.tsx`) cover discovery,
home/me/follows, published prayers/events/announcements, requests, check-in and analytics.
Mobile auth (`M/auth/{login,refresh,logout}`, plan 002) now issues/rotates/revokes the
bearer credential the rest of `M/` depends on.
The following mobile capability is **not built yet** and blocks the linked mobile features.
All rows ☐ unless marked. Register any new `M/` route with OpenAPI + tests.

| ID    | Task                                                                                                                                                                                                                                         | Blocks (mobile)                              | Done |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---- |
| MB-01 | **Mobile auth**: `POST M/auth/{login,refresh,logout}` issue/rotate/revoke short-lived bearer (done plan 002). Register reuses existing `/auth/signup` (out of 002 scope). Bearer accepted by `required-auth` w/ `auth_version`+active check. | Accounts+Onboarding, all authenticated flows | ✓    |
| MB-02 | **Donations**: `POST M/churches/:churchId/donations` → DonationInput + provider launch params + attempt ref; `GET M/me/donation-attempts/:attemptId` → confirmed/pending/failed outcome. Idempotent, subject-only.                           | Donations (DN1–DN6)                          | ☐    |
| MB-03 | **DonationOptions** projection on `MobilePublicChurch` (currencies, presets low/minor, monthly flag) or a jointly-agreed equivalent.                                                                                                         | Donations (DN2)                              | ☐    |
| MB-04 | **Notification preferences**: `GET/PUT M/me/notification-preferences` — donation reminder defaults **false**; server allowlists required types.                                                                                              | Notifications (V5)                           | ☐    |
| MB-05 | **Device registration**: `PUT/DELETE M/me/devices/:installationId` — bind native FCM/APNs token per installation, rotate, revoke on logout.                                                                                                  | Notifications (V4/V6)                        | ☐    |
| MB-06 | **Account deletion**: `DELETE M/me` (202, reauthenticated subject) — distinguish accepted vs completed.                                                                                                                                      | Deletion (L2)                                | ☐    |
| MB-07 | **Data exports**: `POST M/me/data-exports`, `GET M/me/data-exports/:jobId` — private result when ready.                                                                                                                                      | Export (L4)                                  | ☐    |
| MB-08 | **Detail routes**: `GET M/churches/:churchId/events/:eventId`, `.../announcements/:announcementId` — reload + deep-link after push.                                                                                                          | Events (EV1 deep-link)                       | ☐    |
| MB-09 | **Playable media**: expose a short-lived signed URL for approved published audio (today `MobilePublishedAudio` returns `assetId/assetKey` only). Reuse the media-access signing flow from X-04.                                              | Prayers audio (PR3/PR5)                      | ☐    |
| MB-10 | **Home projection**: replace `latest*: unknown[]` in `MobileHome` with a typed minimal projection (`prayers`, `nextService`, `upcomingEvent`, `announcement`) or the agreed alternative.                                                     | Home (H1)                                    | ☐    |
| MB-11 | **Church summary coordinates**: add `coordinates` to `MobileChurchSummary` so list markers/distance are buildable.                                                                                                                           | Discovery map (D3)                           | ☐    |
| MB-12 | **Church profile pastors + donationOptions**: add rendered `pastors[]` and donation projection to `MobilePublicChurch`.                                                                                                                      | Church profile (CP1)                         | ☐    |
| MB-13 | **Profile version field**: add `version` to `MobileMe` + `PATCH M/me` optimistic-concurrency guard for multi-device stale-write protection.                                                                                                  | Profile (P1)                                 | ☐    |
| MB-14 | **Event timezone**: add `timezone` to `MobilePublicEvent`.                                                                                                                                                                                   | Events (EV3)                                 | ☐    |
| MB-15 | **Password recovery (mobile)**: `POST M/auth/forgot-password` + `POST M/auth/reset-password` — deep-link reset, soft-success, incremental 429 cooldown (1→3→5→10 min max).                                                                   | Accounts+Onboarding                          | ✓    |

**Build order (parallel):** MB-10/11/12/13/14 are pure DTO additions to already-live routes —
fast, independent, no auth dependency. MB-04/05 build on the existing notification provider.
MB-01 (auth) should go first — it unblocks the mobile authenticated flows. MB-02/06/07 need
D6/D9 decisions before implementation. MB-09 reuses the X-04 media-signing flow.

Convention: these are the sharing handoffs consumed by the mobile client per
`prayer-365-mobile-app/docs/TASK.md`. Do not change an already-live `M/` field name/shape
without a joint announce, because the mobile `api.ts` layer maps to the built shapes.

---

## Feature Build Order (suggested)

1. F1CH Churches — foundation UI, establishes hooks + upload pattern
2. F12ST Staff/Roles — permission-driven visibility for every other screen
3. F3PR Prayers + F4VO Voice — core product flow (voice first: My Voice → review → ready voice → prayer audio)
4. F5EV Events, F6AN Announcements, F7RQ Requests
5. F8DO Donations, F9ANL Analytics/Regions, F10NO Notifications
6. F11ORG Organization
7. Cross-cutting X items alongside UI QA (X-01/02/03 early, X-09/10/11 last)

## Open Decisions Blocking Completion (do not guess — confirm with owner)

| Ref | Question                                                                                                                                                        | Blocks               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| D1  | Mobile token issuance/refresh contract — RESOLVED (plan 002 implemented `/api/v1/mobile/auth/{login,refresh,logout}`)                                           | X-07 (done)          |
| D2  | Suspension/archive effects (visibility, publishing, staff, donations, notifications)                                                                            | F1CH lifecycle, F8DO |
| D3  | Meaning of request "manage" beyond view/contact                                                                                                                 | RQ-08                |
| D4  | Text-only publishing, post-publication edits, reviewer mapping, timezone                                                                                        | PR-06                |
| D5  | ElevenLabs verification completion path, voice-slot limits                                                                                                      | VO-07                |
| D6  | Payment charge model, currencies, fees, reporting totals                                                                                                        | DO-09                |
| D7  | Check-in dedupe rule                                                                                                                                            | check-in API         |
| D8  | Hierarchy reassignment reporting, country powers                                                                                                                | OR-08                |
| D9  | Notification recipients/timing defaults                                                                                                                         | NO-09                |
| D10 | Retention/deletion policy + legal text                                                                                                                          | privacy jobs         |
| D11 | Hosting + tooling confirmation                                                                                                                                  | X-09                 |
| D12 | Minimal content contracts: announcement fields, service-time representation, text/upload limits, translations; church-staff editing of shared pastor name/intro | F1CH, F6AN           |
