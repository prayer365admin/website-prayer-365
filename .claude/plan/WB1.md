# PRAYER Customer-Facing Website — WB1 User Onboarding Plan

Prepared: 12 October 2026. Source: `docs/website/TASK.md` (WB1, WB-11..WB-18),
`docs/website/design/wb1/*.png`, decisions agreed during WB1 planning. Issues
for separate tickets live in `docs/website/REPORT/WB1.md`.

Verify after each phase: `bun run typecheck && bun run lint && bun run test`
and `next build`.

## Status

| Phase | Scope                                                           | Status  |
| ----- | --------------------------------------------------------------- | ------- |
| 0     | Verify foundation, WB-18 signup test                            | ✔ done |
| 1     | Backend: signup guards, public picker, site `/me` routes        | ✔ done |
| 2     | Data hooks + shared auth UI pieces                              | ✔ done |
| 3     | Screens: sign-in, 3-step sign-up, verify, forgot/reset, profile | ☐ next  |
| 4     | Flow tests + final verify                                       | ☐       |

## Decisions (agreed)

| Ref | Decision                                                                               |
| --- | -------------------------------------------------------------------------------------- |
| B1  | `locale` + `main_church_id` mandatory at signup; guard clauses in `registerUser`.      |
| B1a | Shared `/api/v1/auth/signup` is strict for everyone (mobile must follow, REPORT R-06). |
| B1b | Signup assigns the `prayer_user` role. Dashboard follow-up is REPORT R-01.             |
| B2  | Public picker API, no auth, `{id, name, city}` only. Frequent = top 4 by followers.    |
| B3  | Notification checkboxes: UI only, no action (REPORT R-03).                             |
| B4  | Alternative sign-in buttons: UI only, no action (REPORT R-04).                         |
| F1  | Sign-in follows the design as drawn.                                                   |
| F2  | Side-panel stats hardcoded for now (REPORT R-05).                                      |
| F3  | Step 3 checkboxes shown, no action.                                                    |
| F4  | `/setup` (W05) out of scope; not touched.                                              |
| —   | Header and footer in the screenshots are ignored.                                      |
| —   | Verify, forgot/reset and profile have no design: reuse the auth card style.            |
| —   | `/admin/login` keeps its current plain look.                                           |
| —   | Copy ships in English first; et/sv/fi copy English until translations arrive.          |

## Phase 0 — Verify foundation ✔

- WB-01..WB-06 already built (commit `3d83eb1`).
- Dashboard guard redirects role-less sessions to `/`.
- `src/controller/auth.test.tsx` added (WB-18).

## Phase 1 — Backend ✔

- `registerUser` guards: `INVALID_LOCALE`, `INVALID_MAIN_CHURCH`,
  `CUSTOMER_ROLE_MISSING`; `CREATE_CUSTOMER` writes user (`prayer_user`,
  locale) + main church row in one transaction.
- `GET /api/v1/public/churches?search=` (max 20) and
  `GET /api/v1/public/churches/frequent` (top 4, CDN cache 1 h).
- `PATCH /api/v1/site/me` (strict `SiteMePatchSchema`), `GET site/me/churches`,
  `PUT/DELETE site/me/follows/:churchId`, `POST site/me/avatar`.

## Phase 2 — Data hooks + shared auth UI ✔

Goal: every building block the Phase 3 screens need, tested in isolation. No
pages are wired in this phase.

### 2A. Data hooks — `src/hooks/data/site/`

Same pattern as `src/hooks/data/*.tsx` (TanStack Query + axios). Query keys
carry the session user id for anything private.

| File                | Hooks                                                       | Calls                                                               | Used by        |
| ------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- | -------------- |
| `church-option.tsx` | `useChurchOptions(search)`, `useFrequentChurches()`         | `GET public/churches?search=`, `GET public/churches/frequent`       | Sign-up step 2 |
| `auth.tsx`          | `useSignup()`                                               | `POST auth/signup`; returns `error_code` for field errors, no toast | Sign-up step 3 |
| `me.tsx`            | `useMe()`, `usePatchMe()`, `useMyChurches()`, `useFollow()` | `site/me`, `site/me/churches`, `site/me/follows/:id`                | Profile        |
| `avatar.tsx`        | `useAvatarUpload()`                                         | `POST site/me/avatar` → S3 presigned POST → `PATCH site/me`         | Profile        |

- `useChurchOptions` debounces the search (300 ms) so typing does not fire a
  request per key.
- `useSignup` maps backend codes to i18n keys: `USER_EXISTS`,
  `INVALID_LOCALE`, `INVALID_MAIN_CHURCH`, `INVALID_PASSWORD`,
  `PASSWORD_MISMATCH`, `INVALID_EMAIL`.
- Tests: one test file per hook file, axios mocked.

### 2B. Shared auth UI — `src/components/site/auth/`

Ant Design + Tailwind, existing tokens (`primary_color` = `#2f7ad2`, fonts
`font_heading` Manrope, `font_quote` Instrument Serif).

| Component          | What it is (from the screenshots)                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuthLayout`       | Soft blue gradient page, two columns on desktop (form + aside), one column on phones. Order is swapped per page: sign-in = form left, sign-up = aside left. |
| `AuthCard`         | White rounded card split into header / body / footer sections by dividers.                                                                                  |
| `Pill`             | Small rounded badge ("Sanctuary Portal", "Nordic-Baltic Ecumenical Fellowship", "Optional").                                                                |
| `ScriptureQuote`   | Quote mark, italic serif quote, spaced caps reference ("PSALM 145:18").                                                                                     |
| `StepHeader`       | Number circle + section title + optional pill; "Form n of 3" label for the card header.                                                                     |
| `PasswordStrength` | 4-bar meter + "Key strength" label + "8+ characters recommended". Scoring is a pure function.                                                               |
| `SignInAside`      | Live-stream card (dark blue, praying hands, quote, fake player), bell reminder card, privacy seal card. Hardcoded (F2).                                     |
| `SignUpAside`      | Journey card (app icon, pill, title, quote), "Active Regional Sanctuaries" stats card + church photo, privacy note. Hardcoded (F2).                         |

- All copy goes into `src/i18n/messages.ts` (en; et/sv/fi copy en for now).
- Tests: `PasswordStrength` scoring, `StepHeader` renders number/title/pill,
  both asides render their hardcoded copy.

### 2C. Delivered notes

- Icons: 14 components in `src/components/icon/` generated from
  `public/icons/*.svg` with the `_template.tsx` pattern. Fill is
  `currentColor`, size `1em`; set `color` / `fontSize` to theme them.
  Arrows, play, sound, user use `@ant-design/icons` built-ins.
- Church photo: `public/images/sign-up-banner.jpg`. App icon:
  `public/images/icon.jpg` (also stands in for the missing white
  praying-hands art, REPORT R-05).
- i18n: `t(key, vars)` now falls back to English for keys a locale does not
  have yet, and fills `{name}` placeholders.
- Password strength: empty = 0, under 8 characters = 1, else one point each
  for length, mixed case, digit, symbol.

## Phase 3 — Screens

- **W01 sign-in** (`/login`): `AuthLayout` + `AuthCard` + `SignInAside`.
  Member ID placeholder, "Keep me signed in", ChurchID (EELK) and Magic Link
  are UI only. Unverified email → verify page with resend. `/admin/login`
  keeps the plain look.
- **W02 sign-up** (`/register`), 3 steps in one `Form`:
  1. Name, email, password + strength meter.
  2. Main church picker + 4 frequent chips (required; "Optional" pill and
     "Browse as Pilgrim" default removed).
  3. Language (required) + 2 checkboxes (UI only) → "Create Sacred Account".
  - Next validates only the current step; Back keeps values; one submit;
    success → "check your email" state.
- **W03 verify**, **W04 forgot/reset**: auth card style, soft-success on
  forgot, reset → `/login`.
- **W13 profile** (`/profile`): name, language, main church, follows, avatar,
  sign out.

## Phase 4 — Flow tests + final verify (WB-17)

- Wizard: per-step validation, Back keeps values, single submit.
- Register → verify → sign in; unverified blocked; reset flow.
- Locale + main church saved at signup; exactly one main church.
- Full verify run; update TASK.md WB1 rows.
