# PRAYER Customer-Facing Website — Issue Report (WB1)

Prepared: 12 October 2026, updated 13 October 2026 (sign-in and sign-up pages
built). Source: WB1 User Onboarding planning, Phase 0 verification and the
sign-in / sign-up implementation. Each item below is out of WB1 scope or needs
a separate decision. Raise each one as its own ticket.

| #    | Issue                                                                   | Area    | Severity | WB1 handling                         |
| ---- | ----------------------------------------------------------------------- | ------- | -------- | ------------------------------------ |
| R-01 | `prayer_user` customers can enter the admin dashboard                   | BE + FE | High     | Not fixed; reported only             |
| R-02 | Staff with only a role assignment are treated as customers              | BE      | Medium   | Not fixed; reported only             |
| R-03 | Notification preferences have no backend                                | BE      | Medium   | UI only, values discarded            |
| R-04 | Alternative sign-in methods have no backend                             | BE      | Medium   | UI only, buttons do nothing          |
| R-05 | Hardcoded stats and live stream in auth side panels                     | FE + BE | Low      | Hardcoded as designed                |
| R-06 | Mobile signup breaks: locale now required                               | Mobile  | High     | Backend strict; mobile not updated   |
| R-07 | Main church / locale rules differ between website and mobile `PATCH me` | BE      | Medium   | Website route strict only            |
| R-08 | False "zero-knowledge encryption" claim in auth copy                    | Content | High     | Shown as designed; fix before launch |
| R-09 | Deploy prerequisite: `prayer_user` role must be seeded                  | Ops     | High     | Signup returns 500 without it        |
| R-10 | Website styles changed some admin screens                               | FE      | Medium   | Not fixed; reported only             |
| R-11 | Sign-up banner photo has a mock form baked into the image               | Content | Medium   | Used as provided                     |
| R-12 | Customers can have no main church (now optional)                        | FE + BE | Medium   | Signup allows it; Home/Profile TBD   |
| R-13 | et/sv/fi translations need native-speaker review                        | Content | Medium   | Drafted, not yet reviewed            |
| R-14 | Design gaps decided during build                                        | Design  | Low      | Built; needs design sign-off         |
| R-15 | Shared root providers limit website performance                         | FE      | Low      | Login ~90 Lighthouse (mobile)        |

---

## R-01 — `prayer_user` customers can enter the admin dashboard

**Context.** In WB1, public signup assigns the `prayer_user` role to every new
customer (decision taken during WB1 planning). `prayer_user` has no permission
grants (`prisma/seeds/prayer-roles.ts`, "END-USER (mobile customer) — no admin
grants by default").

**Problem.** The dashboard guard (`src/app/dashboard/layout.tsx`) only blocks
sessions with **no** role:

```ts
if (!session.user.role) {
  redirect('/')
}
```

A `prayer_user` session has a role, so it passes the guard and renders the
admin shell. Every admin API still denies it (no grants), but the customer sees
an empty admin dashboard. This conflicts with the website rule "website users
cannot reach admin routes" (`docs/website/SPEC.md` §10, TASK.md Definition of
done).

**To decide.**

- How the dashboard tells customers from staff: role name (`prayer_user`),
  "has at least one admin grant", or a dedicated user type flag.
- Whether `/admin/login` should reject customers at sign-in or only redirect
  after sign-in.
- Whether `src/app/api/v1/auth/login/route.ts` (requires a role) should accept
  or reject `prayer_user`.
- How the existing role-less customers (`role_id = null`, created before WB1
  and by seeds) are migrated or kept.

**Related.** SPEC decision W1 (`docs/website/SPEC.md` §3, §13) still says
"Open". WB1 effectively uses Option B (assign `prayer_user` on signup); update
the decision register when this ticket is decided.

---

## R-02 — Staff with only a role assignment are treated as customers

**Problem.** Seeded staff accounts have both `User.role_id` and a
`role_assignments` row. Granting an assignment through
`src/controller/role-assignment.tsx` writes only the `role_assignments` row
and does not set `User.role_id`. A user who signs up via `/register` and is
then given only an assignment keeps their signup role, so the dashboard treats
them as a customer.

**Made worse by WB1.** Public signup now requires a language and assigns
`prayer_user`. `/register` is now the customer 3-step sign-up; the old plain
register screen (`src/contents/register`) was removed. A staff member
registering through `/register` is created as a customer, and there is no
separate staff self-registration any more.

**To decide.**

- How staff accounts are created: admin invite from user management, or
  self-signup followed by promotion.
- Whether granting an assignment should also set or replace `User.role_id`.

---

## R-03 — Notification preferences have no backend

**Design.** Sign-up step 3 shows two checkboxes:

- "Daily Morning Devotional Scripture" (dawn scripture, reflection and psalm at
  06:30).
- "Parish Urgent Prayer Alerts" (prayer chains for hospitalized parishioners,
  bereavement, community distress).

**Current state.** There is no preference field on `User`, no email or push
delivery for either item, and push notifications are out of website scope
(`docs/website/FEATURE.md`). In WB1 the checkboxes are UI only and their values
are not sent or stored.

**Ticket needs.**

- Storage: preference columns on `User` or a `user_notification_preferences`
  table.
- Delivery channel: email, push, or both.
- Scheduling: who sends the 06:30 message and in which timezone (user locale,
  church wall clock).
- What triggers an "urgent prayer alert" and who can send one.
- Opt-out and a GDPR consent record.

---

## R-04 — Alternative sign-in methods have no backend

**Design.** The sign-in screen shows:

- "Member ID or Pastoral Email" as the login field.
- "Keep me signed in for daily devotional vigils" checkbox.
- "ChurchID (EELK)" button.
- "Passwordless Magic Link" button.

**Current state.** Only email and password sign-in exists (NextAuth
credentials, `src/auth.ts`). In WB1 these are UI only: the field accepts email,
and the checkbox and both buttons do nothing.

**Ticket needs.**

- **Member ID:** a member number field on `User`, unique per church or
  globally, and how it is issued.
- **Keep me signed in:** short versus long session lifetime. NextAuth JWT
  sessions already last 30 days by default.
- **ChurchID (EELK):** an external identity provider (OIDC or SAML). Needs an
  agreement with EELK, their endpoints, and account linking for existing
  emails.
- **Magic Link:** a one-time email token flow (the existing reset-token
  pattern in `src/controller/auth.tsx` can be reused), rate limits and expiry.

---

## R-05 — Hardcoded stats and live stream in auth side panels

**Design.** The sign-in and sign-up side panels show live-looking data:

- Sign-in: "Live sanctuary stream", "418 fellowship members are currently
  keeping silent prayer watch", "Evening Choral Vespers" player, "Sanctuary
  Bell Reminder 19:00 EET", "Joined by pastors across 14 Baltic dioceses".
- Sign-up: "142 Parishes", "Morning Vespers 4,812 interceding today", "Baltic
  Dioceses 18", "EE, LV, LT, FI", church photo "St. John's Church (Jaani
  kirik), Tallinn".

**Current state.** In WB1 these are hardcoded text as designed (decision F2).
`docs/website/DESIGN.md` says "do not show fabricated totals", so the numbers
must be replaced with real data or removed before launch.

**Ticket needs.**

- Data source for each number (active users, church count, dioceses,
  countries).
- Whether the live stream and the evening player exist as a feature at all
  (live audio is not in website scope).
- Caching for any public counts shown before sign-in.

**Security claim:** moved to R-08.

**Missing assets (placeholders used in WB1).**

- ~~White line-art praying hands on the dark live-stream card~~: resolved,
  now `OutlinedLogoIcon` (`src/components/icon/outlined-logo.tsx`).
- Three pastor photos next to "Joined by pastors across 14 Baltic dioceses":
  generic user avatars are used instead.

---

## R-06 — Mobile signup breaks: locale now required

**Change in WB1.** The shared `POST /api/v1/auth/signup` now requires `locale`
(en/et/sv/fi) and creates the user with the `prayer_user` role (decision:
shared endpoint, strict). `main_church_id` is optional (changed 13 Oct 2026),
but when sent it must be an APPROVED church. A missing/invalid locale returns
400 `INVALID_LOCALE`; an unknown or unapproved church returns 400
`INVALID_MAIN_CHURCH`.

**Impact.** The mobile app (`prayer-365-mobile-app`,
`src/features/auth/screens/SignupScreen.tsx`) sends only `full_name`, `email`,
`password` and `confirm_password`, so mobile signup fails until the app is
updated. Its current error handling shows "Signup is coming soon".

**Ticket needs (mobile).**

- Add a language choice (required) and, optionally, a main church picker to
  the mobile signup flow.
- Use the public pickers: `GET /api/v1/public/churches?search=` and
  `GET /api/v1/public/churches/frequent` (no session, `{id, name, city}`).
- Send `locale` (and `main_church_id` when chosen) in the signup body and map
  the two new error codes.

---

## R-07 — Main church / locale rules differ between website and mobile `PATCH me`

**Problem.** Locale is mandatory for customers; the main church became
optional on 13 Oct 2026 (signup no longer requires it). The two profile routes
disagree:

- Website `PATCH /api/v1/site/me` (`SiteMePatchSchema`): locale must be a site
  locale and cannot be cleared, and the main church **cannot be cleared**
  either (no `null`). That still reflects the old "main church required" rule.
- Mobile `PATCH /api/v1/mobile/me` (`MobileMePatchSchema`): accepts
  `locale: null`, any locale string up to 10 characters, and
  `mainChurchId: null`.

**To decide.**

- Should a customer be able to clear their main church from the website
  profile now that it is optional? If yes, allow `mainChurchId: null` in
  `SiteMePatchSchema`.
- Should the mobile route stop accepting a null or unsupported locale (check
  the mobile app first)?
- What to do with existing users without a locale (created before WB1, or by
  seeds).

---

## R-08 — False "zero-knowledge encryption" claim in auth copy

**Problem.** The sign-in "Pastoral Privilege Seal" card says "256-bit
zero-knowledge encryption ensures your private prayer intentions, confessions,
and journal entries remain strictly confidential between you and the Divine".
PRAYER has no zero-knowledge or end-to-end encryption, and the website has no
confessions or journal feature. The sign-up privacy note ("strict pastoral
covenant and canonical privacy protections. We never share baptismal
details...") also promises things that are not defined anywhere.

The copy is shown as designed and is now translated into all four languages
(`sealBody`, `privacyNote` in `src/i18n/messages.ts`).

**Ticket needs.**

- Replace with an accurate statement in en/et/sv/fi, ideally linked to the
  website privacy notice (open decision W5).
- Legal / privacy review before the site goes public.

---

## R-09 — Deploy prerequisite: `prayer_user` role must be seeded

**Problem.** Signup creates customers with the `prayer_user` role, looked up by
name. If an environment has not been seeded, signup fails with 500
`CUSTOMER_ROLE_MISSING` (deliberately loud, instead of creating users without a
role).

**Ticket needs.**

- Confirm `prisma/seeds/prayer-roles.ts` has run on staging and production
  before WB1 is deployed.
- Add it to the deployment runbook / handover checklist.

---

## R-10 — Website styles changed some admin screens

**Problem.** The website design tokens and base styles live in shared global
files, so they also apply to the admin dashboard:

- `src/styles/global.scss` has a global `p { margin: 0; font-size: 16px }`
  rule. Every `<p>` in the admin without its own size class is now 16px.
- The color tokens `gray-100` (#F9FAFB) and `blue-800` (#0B4497) override
  Tailwind's own shades. Admin screens using them changed slightly:
  `src/components/common/form/church-profile`, `church-service-times`
  (`gray-100` was #F3F4F6, `blue-800` was #1E40AF).

**Ticket needs.**

- Scope the `p` rule to website pages (e.g. under a website wrapper class) or
  confirm the admin should follow it.
- Rename the two tokens (or confirm the admin colors may change).

---

## R-11 — Sign-up banner photo has a mock form baked into the image

**Problem.** `public/images/sign-up-banner.jpg` (church photo in the sign-up
"Active Regional Sanctuaries" panel) contains a screenshot of a "Sign Up - Web
Registration" form on the left of the photo. It looks like part of the UI but
is not interactive.

**Ticket needs.** A clean photo of St. John's Church (Jaani kirik), Tallinn, at
least 880 x 256 px (2x the 440 x 128 slot). Also remove the unused
`public/images/sanctuary-banner.png` (4 MB; the page uses the `.webp`).

---

## R-12 — Customers can have no main church (now optional)

**Problem.** Since the main church became optional at signup (13 Oct 2026),
new customers may have no main church and follow nothing.

**Ticket needs.**

- Home feed (WB3, `getHome`): an empty state that points to the church
  directory when there is no main or followed church.
- Profile (WB-16): a way to choose a main church later (see R-07 for clearing
  it).
- Any other feature that assumes a main church exists.

---

## R-13 — et/sv/fi translations need native-speaker review

**Problem.** All website strings (sign-in, sign-up, asides, errors) ship in
en/et/sv/fi (`src/i18n/messages.ts`). The et/sv/fi texts were drafted without
a native speaker. Bible verses follow common wording of each country's standard
Bible, but the faith-specific terms ("osadus", "gemenskap", "yhteys",
"pühamu") are the most likely to need correcting.

**Ticket needs.** Native-speaker review for Estonian, Swedish and Finnish
before launch.

---

## R-14 — Design gaps decided during build

These were built without a design or differ from it; confirm or provide a
design:

- Sign-up "Check your email" success screen: no design, uses the card style.
- Sign-up step 3: a **Back** button was added (the design has none) so users
  can change their parish before creating the account.
- Sign-up on phones: Back centered on top, primary button full width below,
  `md` button size on phones / `lg` on desktop.
- Verify email (W03), forgot / reset password (W04) and Profile (W13): no
  designs; they will reuse the auth card style.
- Background shapes (sign-up blue dot, privacy-note glow): positions matched
  by eye; Figma gave size and color only.

---

## R-15 — Shared root providers limit website performance

**Finding.** Lighthouse (mobile, production build) on `/login`: about 90,
LCP ~3.1 s simulated (real paint ~137 ms), TBT ~200-250 ms, ~370 KB JS. The
login page itself is server-rendered with only the form hydrating; the
remaining JS is the root `GlobalProvider` shared with the admin (React, antd
`ConfigProvider` / `App`, next-auth `SessionProvider`, TanStack Query).

**Ticket needs (optional).** A separate root layout for the public website
pages that skips the providers they do not need. This touches the admin root
layout, so it needs its own ticket and regression check.
