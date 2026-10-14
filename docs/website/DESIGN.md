# PRAYER Customer-Facing Website — Low-Fidelity Design

Prepared: 12 October 2026.

This document describes the website screens in text. It follows
[FEATURE.md](FEATURE.md) and the route map in [SPEC.md](SPEC.md). These are
layout proposals, not final UI. Wireframe images are not yet produced; each
screen below lists its blocks so a designer can convert them to images. The
admin dashboard's `design-assets` folder holds image wireframes for the admin
screens only.

## How to read

- Screen ID prefix `W###` (website). Admin screens use `S##`, mobile `M##`.
- Each screen lists the page route, purpose, blocks, and states.
- All names/amounts/sample text are placeholders, not live data.

## Shared layout

Website pages in the `(site)` route group share a top navigation bar and footer.
The navigation bar shows the PRAYER brand, a language selector, and the signed-in
account menu. `/customer` is intentionally outside that group and has its own
dashboard-style header/content/footer layout without the admin sidebar.

| Element   | Content                                                                |
| --------- | ---------------------------------------------------------------------- |
| Top bar   | PRAYER brand · language switch (en/et/sv/fi) · account menu / sign out |
| Main area | Page content per screen below                                          |
| Footer    | About, contact, privacy note, platform credit                          |

Do not show admin menus to customers. Everything is behind sign-in; the
website never renders content pages to unauthenticated visitors (they go to
sign-in).

Design tokens (WB1): colours live as CSS variables in `src/styles/global.scss`
(`:root`) and are mapped in `tailwind.config.ts`; form sizes in
`siteFormTheme` (`src/config/antdTheme.tsx`). These files are shared with the
admin dashboard, and the admin impact (global `p` rule, `gray-100`, `blue-800`)
is accepted (REPORT R-10).

## Screen Index

| ID  | Screen                  | Purpose                                         | Feature |
| --- | ----------------------- | ----------------------------------------------- | ------- |
| W01 | Sign In                 | Customer login (email + password)               | WF1     |
| W02 | Register                | Create an account                               | WF1     |
| W03 | Verify email            | Confirm the email link result                   | WF1     |
| W04 | Forgot / Reset password | Recover access                                  | WF1     |
| W05 | Language + church setup | Choose language, main church, follow churches   | WF1     |
| W06 | Home (prayer feed)      | Published prayers from main + followed churches | WF3     |
| W07 | Church directory        | Search approved churches                        | WF2     |
| W08 | Church profile          | Church details + Donate entry point             | WF2     |
| W09 | Prayer list / archive   | List published prayers for a context            | WF3     |
| W10 | Prayer detail           | Full prayer text + audio player                 | WF3     |
| W11 | Donation                | Choose one-time/monthly, amount, checkout       | WF4     |
| W12 | Donation result         | Payment result                                  | WF4     |
| W13 | Profile                 | View / edit name, language, profile picture     | WF1     |

## Screens

### W01 — Sign In

**Route:** `/login` — the customer login page. The staff dashboard has its own
separate login at `/admin/login` (not shared; see SPEC §4 note).

- Block: brand + simple card form.
- Fields: email, password.
- Actions: Sign In, link to Register, link to Forgot password.
- On success: go to W05 if the customer has not completed setup, else W06.
- State: unverified email → message "verify your email first" with resend link.
- Built (WB1): image design `design/wb1/page-sign-in.png`. "Member ID",
  "Keep me signed in", ChurchID (EELK) and Magic Link are shown with no action
  (email + password only, R-04). W1 resolved: Option B (SPEC §3).

### W02 — Register

**Route:** `/register` (existing register content).

- Fields: full name, email, password (the image design has no confirm field;
  the request sends the password as confirmation).
- On submit: create account, send verification email.
- Success state: "Check your email" message (does not auto sign in).
- Built (WB1): image design `design/wb1/page-sign-up-step-1.png`. Language and
  main church are not asked here (onboarding, W05).

### W03 — Verify Email

**Routes:** `/verify-email`, `/verify-account`.

- Success: "Email verified — you can sign in now." → link to `/login`.
- Error: "Link invalid or expired" → resend verification link.

### W04 — Forgot / Reset Password

**Routes:** `/forgot-password`, `/reset-password`.

- Forgot: enter email → soft-success message (no account enumeration).
- Reset: token + new password + confirm → success → sign in.
- Built (WB1, decided 14 Oct 2026): the W01 sign-in card **without the
  aside**, same header and quote, title "Forgot Password" / "Reset Password".
  The result ("Check your email!", "Password changed", invalid link) replaces
  the form. Shared by customers and staff.

### W05 — Language and Church Setup

**Route:** `/customer/setup` (first-login onboarding; the optional parish step may be skipped).

- Built (WB1), from image designs `design/wb1/page-sign-up-step-2.png` and
  `-step-3.png`:
  - Step 1: parish connection — search approved churches + 4 frequent chips;
    optional ("Optional" pill).
  - Step 2: language (English / Eesti / Svenska / Suomi) + two notification
    checkboxes (UI only, R-03).
- Actions: "Skip for now" (step 1), Back (step 2), "Enter the Sanctuary"
  finish → Home (W06). Finishing or skipping is remembered per browser.
- Follows beyond the main church and later changes: Profile (W13).

### W06 — Home (Prayer Feed)

**Route:** `/`.

- Block 1: greeting + main church name.
- Block 2: "Today's prayers / latest prayers" cards — title, church, pastor,
  published date, audio button.
- Block 3: followed churches shortcut row.
- Actions: open a prayer (W10), open a church (W08).
- Empty state: "No prayers yet from your churches" + Go to directory (W07).

### W07 — Church Directory

**Route:** `/churches`.

- Search input (name/city) + result grid of church cards (cover, name, city,
  denomination).
- Card action: open church profile (W08).
- Empty: "No churches found" (approved churches only).

### W08 — Church Profile

**Route:** `/churches/:churchId`.

- Header: cover, church name, denomination, city, service times (local wall
  clock).
- Blocks: description, address, contacts, website, languages, accessibility.
- Primary action: **Donate** (W11).
- Secondary: "View prayers" (W09).
- Cross-reference: cover image uses the public `coverUrl` field.

### W09 — Prayer List / Archive

**Route:** `/churches/:churchId/prayers` and `/prayers`.

- List rows: prayer title, church, pastor, published date, play button.
- Pagination per backend list contract.
- Opens prayer detail (W10).

### W10 — Prayer Detail

**Route:** `/prayers/:prayerId`.

- Blocks: title, church + pastor attribution, introduction, full body text,
  audio player (approved audio only, public URL).
- Text-only when no approved audio.
- Accessibility: text size control (AA; not color-only).

### W11 — Donation

**Route:** `/donate/:churchId`.

- Step A: choose one-time or monthly (toggle).
- Step B: predefined amounts + custom amount; currency shown.
- Step C: confirm → Stripe Checkout (one-time) or subscription setup (monthly).
- Button disabled + "Donations not ready yet" note when
  `STRIPE_ENABLED !== 'true'` (provider stub).
- Redirect to Stripe; return to W12.

### W12 — Donation Result

**Route:** `/donate/result`.

- Success / pending / failure states per provider outcome.
- Summary: church, amount, currency, one-time/monthly.
- Never invent a success for an unconfirmed payment; rely on the webhook /
  confirmed outcome.

### W13 — Profile

**Route:** `/customer` (renamed from `/profile`, 14 Oct 2026).

- View / edit: name, language, main church, followed churches.
- Profile picture upload (reuse avatar upload path).
- Sign out action.
- No admin or deletion UI (mobile/website account deletion is out of scope).

## Shared states and interactions

| State                    | What the user sees                                                    |
| ------------------------ | --------------------------------------------------------------------- |
| Loading                  | A loading placeholder; do not show fabricated totals or content.      |
| Empty                    | "No prayers yet" / "No churches found" with a relevant action.        |
| Invalid form             | Keep input and explain beside the affected field.                     |
| Saving                   | Disable repeat submit; confirm only after server acceptance.          |
| Network / provider error | Explain the failure and allow a safe retry.                           |
| Not signed in            | Redirect to sign in; clear sensitive page state.                      |
| Session expired          | Return to sign in.                                                    |
| Donations not ready      | Clear note + disabled checkout when the Stripe integration is a stub. |

Add visible labels and keyboard focus; do not rely on color alone. Show
currency on every donation value. Accessible text size on prayer reading.

## Customer journey (Mermaid)

```mermaid
flowchart LR
    L[W01 Sign In] --> S[W05 Setup]
    S --> H[W06 Home]
    H --> D[W07 Directory]
    D --> C[W08 Church Profile]
    C --> P[W09/W10 Prayer]
    C --> G[W11 Donation]
    G --> R[W12 Result]
    H --> M[W13 Profile]
    L -.->|after setup| H
```

## WB1 design sign-off checklist (R-14)

Built without a design or differing from it. Confirm as built or supply a
design, and record the outcome here. Escalate unclear screens to the Tech Lead.

| Item                                                                            | Status  |
| ------------------------------------------------------------------------------- | ------- |
| W02 "Check your email" success screen (card style, no design)                   | Pending |
| W02 is one step; the design's steps 2-3 became W05 `/customer/setup` (R-06)     | Pending |
| W05 copy: title, subtitle, "Skip for now", "Enter the Sanctuary", "Form n of 2" | Pending |
| W05 step 2 Back button (not in the design)                                      | Pending |
| Phones: secondary action centered on top, primary button full width, `md` size  | Pending |
| W03 verify, W13 profile: reuse the auth card style (W04 decided 14 Oct)         | Pending |
| Background shapes (sign-up dot, privacy-note glow): positions matched by eye    | Pending |

## Future — not designed here

Events, announcements, request forms, check-in, notifications, and exposed
website CMS screens are not part of these wireframes.

## Summary

The website is a light shell with 13 screens covering onboarding, directory,
prayer, donations, and profile. It shares the account flows with the admin and
reuses the public church/prayer content from the backend. Donation screens
need the Stripe integration to be ready before they are end-to-end usable.
