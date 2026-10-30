# WB3 — Prayer (Home-first delivery)

Reviewed: 2026-10-15  
Working branch: `CU-z8qgvc3u9t_Website-Prayer_Dion-Pramana`

## Requirement sources

- `docs/website/TASK.md`: WB-31 through WB-35
- `docs/website/SPEC.md`: sections 4, 5.2, 6.1, 7.3, 9, and 10
- `docs/website/DESIGN.md`: W06, W09, and W10
- `docs/website/FEATURE.md`: WF3 Prayer
- Visual source: `docs/website/design/WB3/`

## Current delivery slice

Deliver **WB-31 / W06 Home first**. Prayer archive, church prayer list, prayer
detail, and the complete audio-reader acceptance work remain later WB3 slices.
The Home implementation may add shared prayer read-model fields that those
later screens require, but it must not build W09 or W10 early.

No WB3 product implementation starts until Phase 0 has reconciled the supplied
Home designs with this plan.

## Goal

Replace the placeholder customer Home page with the designed, authenticated
prayer experience. It must greet the signed-in customer, represent the actual
main and followed church relationships, show the newest eligible prayers from
those churches, expose the designed section entry points, and render honest
empty states without fabricated content.

Only prayers with a published version on an approved church may appear. Only
approved selected audio may be presented as playable. Home must remain useful
when the customer has no main church, follows churches without choosing a main
church, or has churches that have not published a prayer.

## Branch and working-tree notes

- WB3 has its own branch and is not stacked on an unmerged WB2 implementation.
- WB2 is still pending in `docs/website/TASK.md`. Home may link to `/churches`,
  but WB2 owns the directory/profile implementation and the church-profile
  entry point back into Prayer.
- `src/styles/_variables.scss` was already modified before this planning pass.
  Treat it as user-owned work and do not overwrite or reformat it incidentally.
- Do not commit or push; the user owns Git operations.

## Audit summary

| Task  | Document status | Audit status     | Evidence                                                                                                                              | Remaining gap                                                                                       |
| ----- | --------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| WB-31 | ☐               | partial          | `getHome`, `MobileHomeSchema`, customer site shell, authentication guard, main/follow relationships, and a placeholder `/` page exist | Visual reconciliation, relationship/feed correction, attribution fields, Home UI, states, and tests |
| WB-32 | ☐               | deferred         | Church-specific published-prayer controller exists                                                                                    | W09 is intentionally after Home; personalized `/prayers` query does not exist                       |
| WB-33 | ☐               | deferred         | Published-prayer detail controller exists                                                                                             | W10 reader and display attribution do not exist                                                     |
| WB-34 | ☐               | deferred/partial | Approved audio asset key and `S3_PUBLIC_URL` exist                                                                                    | Public playback URL/UI and text-only behavior are not wired                                         |
| WB-35 | ☐               | deferred/partial | Shared provider/controller tests cover some publication gates                                                                         | Website Home and later reader acceptance coverage are missing                                       |

## Findings

### Critical

1. `home-1.png` specifies a two-column devotional hero. The right-side clean
   landscape was not supplied separately, so WB3 adds a project-owned matching
   background while keeping all text and actions as accessible HTML.

### Important

1. `src/app/(site)/page.tsx` is still a placeholder.
2. `GET_HOME` loads latest prayers only for one selected row. It does not merge
   prayers from the customer's main and followed churches as approved for WB3.
3. When there is no true main church, `GET_HOME` currently treats the first
   followed relationship as `mainChurch`. Home must preserve the distinction:
   a followed church is not silently promoted to the customer's main church.
4. `MobilePublishedPrayer` exposes church and pastor IDs but not the names W06,
   W09, and W10 need for visible attribution.
5. Published audio exposes an asset key but no ready-to-render public URL.
6. The shared mobile Home contract is already consumed outside the website.
   Any additive DTO change or feed correction needs regression tests so WB3
   does not accidentally remove mobile fields or relax publication gates.
7. The website copy catalog contains no WB3 strings yet.
8. There is no loading, error, or route-level not-found treatment for WB3.

### Follow-up

- WB2 must eventually implement `/churches` and church profiles so Home's
  directory/church links reach completed destinations.
- `/prayers` is approved as the combined archive for the customer's actual
  main and followed churches; implement it in the next WB3 slice.
- Prayer detail and full audio-reader behavior follow Home sign-off.

## Decisions recorded for implementation

1. Home is the first WB3 delivery and review unit.
2. The supplied WB3 Home images are the visual source of truth. Textual W06
   requirements fill only gaps that the images do not specify.
3. Home includes prayers from the union of the customer's true main church and
   followed churches, deduplicated by church ID and ordered newest first.
4. A followed church is never reported or labelled as the main church unless
   its relationship has `is_main = true`.
5. All published prayer languages are shown initially. Each prayer displays a
   language badge; Home does not hide content based on the customer's locale.
6. The later global `/prayers` archive is personalized to main + followed
   churches, not system-wide.
7. Prayer attribution must expose church name and pastor display name without
   client-side N+1 requests. Extend the server projection/query instead.
8. Public audio URLs are constructed on the server with `S3_PUBLIC_URL` and
   only for approved selected audio. No authentication header or signed URL is
   attached.
9. A prayer without approved audio remains a valid text prayer. Home must not
   render a broken or inactive audio control that implies audio exists.
10. No new database table or migration is expected for Home.
11. Initial Home data is loaded in an authenticated Server Component and passed
    to focused client components only where localization or interaction needs
    them. Do not refetch the same initial payload after hydration without a
    demonstrated need.
12. Next.js 16 conventions apply: pages are Server Components by default, and
    dynamic `params` / `searchParams` are promises in later WB3 routes.
13. Existing Home fields for events and announcements remain compatible; WB3
    does not redesign or fabricate those features.

## Phased implementation

### Phase 0 — Design intake and visual contract

**Goal:** Convert the supplied full Home view and section images into an exact,
testable implementation map before product code changes.

**Files**

- `docs/website/design/WB3/*`
- `.codex/tasks/WB3-prayer.md`
- `docs/website/DESIGN.md` only if the approved design materially changes W06

**Subtasks**

- [x] Locate the WB3 design assets under `docs/website/design/WB3/`.
- [x] Inspect `home-1.png` at original resolution and scope the first delivery
      to its devotional hero.
- [ ] Inventory every Home image, viewport, state, and section variant.
- [ ] Record desktop/mobile breakpoints that can be inferred from the designs.
- [ ] Map every visible section to live data, static approved copy, navigation,
      or an explicit deferred feature.
- [ ] Identify icons/images already available in `public/` and list missing
      assets without substituting unrelated artwork.
- [ ] Verify which audio interaction the Home design shows: direct inline
      playback, open detail, or both.
- [ ] Verify whether events/announcements shown in the design are real Home
      sections or outside the WB3 Home delivery slice.
- [ ] Record measurable spacing, typography, color, radius, and responsive
      behavior in this task after inspection.
- [ ] Reconcile discrepancies against W06 with the user before implementation.

**Acceptance**

- [ ] Every visible Home section has a data source and interaction outcome.
- [ ] No visual element depends on fabricated counts, streams, prayers, or
      church activity.
- [ ] Desktop and mobile review targets are explicit.
- [ ] No unresolved design question can materially change the component tree.

### Phase 1 — Correct and prove the Home prayer projection

**Goal:** Give the Home page one safe, complete server projection matching the
approved relationship and publication rules.

**Expected files**

- `src/models/mobile.tsx`
- `src/providers/mobile.tsx`
- `src/controller/mobile.tsx`, only if the public controller shape changes
- `src/providers/mobile.test.tsx`
- `src/controller/mobile.test.tsx`
- Route/OpenAPI tests if the shared response schema changes

**Subtasks**

- [x] Preserve a true `mainChurch: null` when the user has no main relationship.
- [x] Build the eligible church-ID set from true main + followed relationships,
      remove duplicates, and keep only approved churches.
- [x] Query the newest published prayers across that eligible set with stable
      ordering (`published_at desc`, deterministic ID tie-breaker).
- [x] Use the existing Home result limit of three; `home-1` renders the newest
      item and later sections may consume the remaining items.
- [x] Add church ID/name and pastor ID/display name to the prayer read model in
      the same server query/projection; avoid per-card lookups.
- [x] Add the approved audio public URL while retaining the existing asset
      identity fields needed by mobile and later WB3 work.
- [x] Keep published-version snapshot semantics: title, introduction, body,
      language, pastor identity, and selected audio come from the immutable
      published version.
- [x] Preserve `latestEvents` and `latestAnnouncements` response compatibility.
- [ ] Prove no main/no follows, follows-only, main-only, overlapping main +
      followed, multiple followed churches, and suspended-church cases.
- [ ] Prove drafts, unpublished versions, and unapproved audio are absent.
- [ ] Prove newest-first ordering and the chosen Home limit across churches.

**Acceptance**

- [ ] Home data represents the customer's relationships without silent
      promotion or cross-user leakage.
- [ ] Every prayer card can render its required metadata without another fetch.
- [ ] Audio URL is present only for approved selected audio.
- [ ] Existing mobile response fields and security gates remain compatible.
- [ ] Provider/controller tests cover every relationship state used by Home.

### Phase 2 — Home component foundation

**Goal:** Build reusable, design-matched primitives before assembling the full
page.

**Expected files**

- `src/contents/site/home/index.tsx` — new
- `src/components/site/prayer/*` — new, names finalized from the design audit
- `src/i18n/messages.ts`
- Existing site layout/container/theme files only when the design requires a
  shared correction

**Subtasks**

- [ ] Implement the Home page frame and section container widths from design.
- [x] Implement the `home-1` greeting and devotional presentation.
- [x] Implement the first-section prayer preview/card with church, pastor, published
      date, language, and conditional audio treatment.
- [ ] Implement the followed-church shortcut item/row.
- [ ] Implement section heading/action patterns visible in the design.
- [ ] Add Home/WB3 message keys for en/et/sv/fi, following the existing draft
      translation policy and English fallback behavior.
- [x] Use semantic headings, links, buttons, `<article>`, `<blockquote>`, and
      `<time>` values in the first section.
- [ ] Keep interactive client boundaries narrow; do not make the whole page a
      client component solely for one control.
- [ ] Reuse existing tokens before adding new global styles. Any necessary
      token addition must be scoped and must preserve the user's current
      `_variables.scss` changes.

**Acceptance**

- [ ] Components can render populated and missing-optional-field variants.
- [ ] No-audio prayers contain no misleading playback control.
- [ ] Attribution and language remain visible without relying on color alone.
- [ ] Components match the approved design vocabulary and existing site shell.

### Phase 3 — Assemble W06 Home

**Goal:** Replace the placeholder `/` page with the complete Home experience.

**Expected files**

- `src/app/(site)/page.tsx`
- `src/app/(site)/loading.tsx` if the design includes a route loading state
- `src/app/(site)/error.tsx` only if a route error boundary is justified
- `src/contents/site/home/index.tsx`
- Home components from Phase 2

**Subtasks**

- [x] Revalidate the live website session and obtain the authenticated user ID.
- [x] Load the Home projection on the server; do not call the application's own
      HTTP route from the Server Component.
- [x] Pass the customer display name and projection into the Home content.
- [ ] Assemble every design-approved Home section in the exact visual order.
- [ ] Link prayer cards/actions to `/prayers/:prayerId` even though W10 lands in
      a later WB3 slice; do not fabricate the destination page's completion.
- [ ] Link directory actions to `/churches`, with WB2 dependency documented.
- [ ] Link followed church shortcuts to `/churches/:churchId`.
- [ ] Render a useful follows-only experience without a main-church label.
- [ ] Render distinct empty states for no church relationships and eligible
      churches with no published prayers.
- [ ] Format dates using the active site locale and stable semantic ISO values.
- [ ] Ensure a locale change updates UI copy without altering which prayer
      languages are present.

**Acceptance**

- [ ] `/` no longer contains placeholder content.
- [ ] A main + followed customer sees newest prayers from both scopes.
- [ ] A follows-only customer sees prayer content and no invented main church.
- [ ] An unassociated customer receives the designed directory action.
- [ ] A customer whose churches have no prayers receives the designed
      no-prayers state.
- [ ] Every Home action targets an approved route and has an accessible name.

### Phase 4 — Responsive, interaction, and visual verification

**Goal:** Demonstrate that the implementation matches the supplied views and
remains usable beyond the exact mockup dimensions.

**Subtasks**

- [ ] Verify the primary desktop viewport from the supplied design.
- [ ] Verify a 390px mobile viewport and the mobile design when supplied.
- [ ] Verify intermediate widths for overflow, wrapping, and card reflow.
- [ ] Confirm keyboard order, visible focus, heading hierarchy, and audio-control
      labels.
- [ ] Confirm long customer, church, pastor, and prayer names do not break the
      layout.
- [ ] Confirm missing cover/avatar/audio data uses the approved fallback rather
      than a broken resource.
- [ ] Capture comparison screenshots and record any intentional differences.

**Acceptance**

- [ ] Desktop and mobile screenshots are reviewable against the source designs.
- [ ] No horizontal overflow occurs at supported widths.
- [ ] Content remains operable at 200% zoom and by keyboard.
- [ ] Intentional visual differences have explicit user approval.

### Phase 5 — Tests, verification, and Home sign-off

**Goal:** Prove WB-31 and the Home-relevant portion of WB-35 without claiming
later WB3 screens are complete.

**Expected files**

- `src/app/(site)/page.test.tsx`
- `src/contents/site/home/index.test.tsx`
- Focused component tests as justified
- Shared provider/controller tests from Phase 1
- `docs/website/TASK.md`
- `.codex/tasks/WB3-prayer.md`

**Subtasks**

- [ ] Test authenticated server data handoff and session/user scoping.
- [ ] Test populated Home content and metadata.
- [ ] Test main + followed aggregation and follows-only behavior.
- [ ] Test no-relationships and no-prayers empty states and their actions.
- [ ] Test language badges with no locale-based content filtering.
- [ ] Test approved audio versus text-only prayer rendering.
- [ ] Test link destinations and accessible names.
- [ ] Run focused WB3 tests during implementation.
- [ ] Run `bun run typecheck`.
- [ ] Run `bun run lint`.
- [ ] Run `bun run test`.
- [ ] Run `bun run build`.
- [ ] Mark only WB-31 complete in `docs/website/TASK.md` after evidence passes.
- [ ] Leave WB-32 through WB-35 pending/partial until their own screens and full
      acceptance evidence are delivered.

**Acceptance**

- [ ] All required verification is green.
- [ ] WB-31 has implementation, behavioral tests, and visual evidence.
- [ ] Shared mobile consumers have no contract regression.
- [ ] The user signs off Home before W09 archive work begins.

## Later WB3 slices (not part of Home implementation)

After Home sign-off, extend this task with executable phases for:

1. WB-32: personalized `/prayers` and church `/churches/:churchId/prayers`
   archives with URL-driven pagination.
2. WB-33: `/prayers/:prayerId` reader, attribution, text width, and text-size
   controls.
3. WB-34: complete approved-audio player behavior and public playback checks.
4. WB-35: end-to-end WB3 publication, audio, authorization, and direct-route
   acceptance evidence.

## Execution log

| Date       | Phase                                     | Result                                                                                                                                                                                                                                                                                                                                                                                                                           | Verification                                                                                                                                                                          | Commit/change             |
| ---------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 2026-10-15 | Planning audit                            | Home-first plan created; visual audit waiting for design assets at the stated path                                                                                                                                                                                                                                                                                                                                               | Repository/design-path audit only                                                                                                                                                     | Uncommitted task document |
| 2026-10-15 | Home section 1                            | Implemented `home-1` devotional hero, live main/followed prayer projection, attribution, approved-audio player, text-only/empty states, sharing, and generated clean lake artwork                                                                                                                                                                                                                                                | Focused lint clean; 58 focused tests pass; full lint passes; full suite 1,572 tests pass but suite exits on missing pre-existing `@aws-sdk/client-sqs` dependency                     | Uncommitted               |
| 2026-10-15 | Home section 1 refinement                 | Applied owner measurements/colors/gradients, 672:480 desktop ratio, exact audio icons, duration-driven waveform/progress, five-line quote clamp, and church-only attribution footer                                                                                                                                                                                                                                              | Focused lint clean; 58 focused tests pass, including real duration/progress calculation                                                                                               | Uncommitted               |
| 2026-10-15 | Home section 1 owner checklist (19 items) | Re-audited all items; fixed VBR/Infinity audio duration drift, pill overflow (min 164px, hugs content), and login-style quote icon layout                                                                                                                                                                                                                                                                                        | Focused lint clean; home tests pass                                                                                                                                                   | Uncommitted               |
| 2026-10-15 | Home section 2 (home-2)                   | Four shortcut cards from local `contents/site/home/data.ts`; design copy in en messages; Daily Prayer → /prayers, Find Churches → /churches; Sunday Services and Request Prayer render "Coming soon" (no feature yet)                                                                                                                                                                                                            | Lint/typecheck clean; home + i18n tests pass                                                                                                                                          | Uncommitted               |
| 2026-10-15 | Home section 3 (home-3)                   | Primary parish (real main church, services, Directions), upcoming gatherings (real events, .ics Save Date, RSVP), static scripture/brand quote, habits (design values in data.ts) + real followed churches, prayer petition wired via new POST /api/v1/site/churches/:churchId/requests, stewardship from real active subscription (GET_MY_ACTIVE_GIFT); Bulletin/View All/Manage Giving/One-time Offering not built yet         | Lint clean; typecheck clean except pre-existing missing AWS packages; full suite 1,584 tests pass, only pre-existing `src/lambda/kinds.test.tsx` load failure (`@aws-sdk/client-sqs`) | Uncommitted               |
| 2026-10-16 | W10 prayer detail (WB-33)                 | /prayers/:prayerId reader: shared FeaturedPrayer hero (h1, no transcript link), numbered sections (introduction, body paragraphs with church cover, static benediction), text-size + line-width controls, community strip, sidebar (real pastor bio + church link, static liturgical context with print-to-PDF, real sibling prayers, static crisis card); GET_SITE_PRAYER_DETAIL with published/approved gate and 404           | Lint + typecheck clean; full suite 1,604 tests pass                                                                                                                                   | Uncommitted               |
| 2026-10-17 | WB-35 tests                               | prayer-publication.flow.test.ts runs GET_HOME + archive + church archive + detail on an in-memory DB (Postgres NULL ordering): draft/scheduled/suspended hidden, only APPROVED audio with a file playable, plain public URL; mutation-checked (removing gates fails 3 tests). Player test (no crossorigin), archive text-only test. Staging audio: unauthenticated 200 audio/mpeg, range 206. TASK.md: WB-33 ◐, WB-34 ✔, WB-35 ✔ | Targeted suites pass                                                                                                                                                                  | Uncommitted               |
| 2026-10-17 | Home Spiritual Habits real data           | Streak from check-ins (consecutive local_date ending today/yesterday), prayers this week = distinct prayer_listen resource ids since Monday UTC; website player records prayer_listen on first play via new POST /api/v1/site/analytics-events; ring 2 label "prayers this week" (4 locales). Fixed env drift: antd 6.6.6 left by aborted merge install -> clean reinstall from lockfile (6.6.5)                                 | Full suite 1,628 pass; typecheck + lint clean                                                                                                                                         | Uncommitted               |
| 2026-10-17 | Habits: mins this week                    | Second ring back to "mins This week" (goal 60): website player sends one prayer_listen_minute per full minute actually played (timeupdate, wall-clock at any speed, seeks skipped, key session:minute); provider counts them since Monday UTC. New event type is an allowlist entry only, no schema change. Mobile listening counts once the app sends the same event                                                            | Full suite 1,629 pass; typecheck + lint clean                                                                                                                                         | Uncommitted               |
