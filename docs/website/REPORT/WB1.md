# PRAYER Customer-Facing Website — Issue Report (WB1)

Prepared: 12 October 2026. Source: WB1 User Onboarding planning and Phase 0
verification. Each item below is out of WB1 scope or needs a separate decision.
Raise each one as its own ticket.

| #    | Issue                                                      | Area    | Severity | WB1 handling                       |
| ---- | ---------------------------------------------------------- | ------- | -------- | ---------------------------------- |
| R-01 | `prayer_user` customers can enter the admin dashboard      | BE + FE | High     | Not fixed; reported only           |
| R-02 | Staff with only a role assignment are treated as customers | BE      | Medium   | Not fixed; reported only           |
| R-03 | Notification preferences have no backend                   | BE      | Medium   | UI only, values discarded          |
| R-04 | Alternative sign-in methods have no backend                | BE      | Medium   | UI only, buttons do nothing        |
| R-05 | Hardcoded stats and live stream in auth side panels        | FE + BE | Low      | Hardcoded as designed              |
| R-06 | Mobile signup breaks: locale + main church now required    | Mobile  | High     | Backend strict; mobile not updated |
| R-07 | Mobile `PATCH me` can still clear main church and locale   | BE      | Medium   | Website route strict only          |

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

**Made worse by WB1.** Public signup now requires a main church and a language
and assigns `prayer_user`. A staff member registering through `/register` must
pick a church and is created as a customer.

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

**False security claim (fix before launch).** The sign-in "Pastoral Privilege
Seal" card says "256-bit zero-knowledge encryption ensures your private prayer
intentions, confessions, and journal entries remain strictly confidential".
PRAYER has no zero-knowledge or end-to-end encryption, and the website has no
confessions or journal feature. The same goes for "canonical privacy
protections" in the sign-up privacy note. Shown as designed in WB1, but this
copy must be replaced with an accurate statement (link to W5 privacy text)
before the site goes public.

**Missing assets (placeholders used in WB1).**

- ~~White line-art praying hands on the dark live-stream card~~: resolved,
  now `OutlinedLogoIcon` (`src/components/icon/outlined-logo.tsx`).
- Three pastor photos next to "Joined by pastors across 14 Baltic dioceses":
  generic user avatars are used instead.

---

## R-06 — Mobile signup breaks: locale + main church now required

**Change in WB1.** The shared `POST /api/v1/auth/signup` now requires `locale`
(en/et/sv/fi) and `main_church_id` (an APPROVED church) and creates the user
with the `prayer_user` role (decision: shared endpoint, strict). Missing or
invalid values return 400 `INVALID_LOCALE` / `INVALID_MAIN_CHURCH`.

**Impact.** The mobile app (`prayer-365-mobile-app`,
`src/features/auth/screens/SignupScreen.tsx`) sends only `full_name`, `email`,
`password` and `confirm_password`, so mobile signup fails until the app is
updated. Its current error handling shows "Signup is coming soon".

**Ticket needs (mobile).**

- Add a language choice and a main church picker to the mobile signup flow.
- Use the public pickers: `GET /api/v1/public/churches?search=` and
  `GET /api/v1/public/churches/frequent` (no session, `{id, name, city}`).
- Send `locale` and `main_church_id` in the signup body and map the two new
  error codes.

---

## R-07 — Mobile `PATCH me` can still clear main church and locale

**Problem.** WB1 makes main church and locale mandatory for customers. The
website route `PATCH /api/v1/site/me` enforces this (`SiteMePatchSchema`: no
null, site locale only). The mobile route `PATCH /api/v1/mobile/me` still uses
`MobileMePatchSchema`, which accepts `mainChurchId: null` and `locale: null`
and any locale string up to 10 characters, so a mobile user can clear both.

**To decide.**

- Whether the mobile route switches to the same strict rules (check the mobile
  app first: it may rely on clearing the main church).
- What to do with existing users who have no main church or locale (created
  before WB1, or by seeds).
