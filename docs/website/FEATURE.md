# PRAYER Customer-Facing Website — Feature Breakdown

Prepared: 12 October 2026.

## Scope

This document defines the feature baseline for the customer-facing website.
The website is a simplified browser version of the PRAYER mobile app, scoped
to **User Onboarding**, **Prayer**, and **Donations**. It lives inside
`prayer-365-dashboard` and reuses the shared backend.

Only current-scope features below are in the baseline. An unspecified field,
screen, status, or workflow is not an implied requirement. Deferred items are
listed at the end; do not build them within this delivery.

Feature IDs use the `WF` prefix to avoid clashing with the admin (`F`) and
mobile (`F`) feature numbers. Screen IDs use `W###` (see `DESIGN.md`).

## Feature Table

| #   | Feature                                   | Included scope                                                                                 |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| WF1 | [User Onboarding](#wf1-user-onboarding)   | Register, email verify, sign in, forgot/reset password, language, main church, follow, profile |
| WF2 | [Church Directory](#wf2-church-directory) | Approve-church search/directory and a church profile page                                      |
| WF3 | [Prayer](#wf3-prayer)                     | Home prayer feed, prayer list / archive, prayer detail with text and audio                     |
| WF4 | [Donations](#wf4-donations)               | One-time and monthly giving to a church via Stripe, payment result                             |

## WF1 — User Onboarding

**Purpose:** Let a customer create an account, verify it, sign in, and set up
their personal preferences before using the site.

**Users:** All website customers.

**Required behavior:**

- Register with name, email, and password (min length enforced).
- Verify email via a emailed link (reuse `/api/v1/auth/signup`,
  `/api/v1/auth/verify-email`, `/api/v1/auth/resend-verification`).
- Sign in with email and password (NextAuth credentials session).
- No content is shown before sign-in.
- Forgot and reset password (reuse `forgot-password` / `reset-password`).
- Choose an interface language: English, Estonian, Swedish, Finnish.
- Choose a main church and follow additional churches.
- View and edit their own profile (name, language, profile picture).

**Acceptance criteria:**

- A new customer can register, verify, and sign in.
- Unverified customers cannot sign in (email not verified → prompt to verify).
- A signed-in customer can set language, choose a main church, follow
  churches, and update their profile.
- A customer account (`User.role_id = null`) can complete the full sign-in
  flow — NextAuth currently requires a role, so this needs a customer branch.
- The same email cannot register twice.
- Password reset works end to end.

## WF2 — Church Directory

**Purpose:** Help customers find a church, then visit its profile to read its
prayers and donate.

**Users:** Signed-in customers.

**Required behavior:**

- Show approved churches only (never suspended or archived).
- Search churches by name/city.
- Open a church profile with name, description, cover, address, contacts,
  languages, service times, and the "Donate" entry point.

**Acceptance criteria:**

- Only approved churches are listed (server-enforced).
- A church profile renders the public data from the shared `getPublicChurch`
  controller, including cover URL (`coverUrl`) and service times in the
  church wall clock.
- No private fields (approval info, staff, payment data) are exposed.
- A customer can navigate from a church profile to its prayers and to donate.

## WF3 — Prayer

**Purpose:** Let customers read and listen to published prayers from their
main and followed churches.

**Users:** Signed-in customers.

**Required behavior:**

- Home prayer feed: published prayers from the main church and followed
  churches.
- Prayer list and archive for a chosen context.
- Prayer detail: title, introduction, full text, pastor attribution, and the
  prayer audio player when approved audio exists.
- Prayer audio plays from its public media URL (approved audio only).

**Acceptance criteria:**

- Only published prayer versions of approved churches appear.
- Un-approved or draft content never appears.
- A prayer without approved audio shows text only; a prayer with approved
  audio shows a working player using the public S3 URL (D13).
- Audio plays for all listeners without an auth header (public bucket, same
  as mobile).

## WF4 — Donations

**Purpose:** Let a customer give a one-time or monthly donation to a church.

**Users:** Signed-in customers.

**Required behavior:**

- Choose a church and start a donation from its profile.
- Choose one-time or monthly (recurring) giving and a predefined or custom
  amount in a supported currency.
- Redirect to Stripe Checkout for one-time, or Stripe subscription setup for
  monthly.
- Return to a donation result page after checkout.
- The backend verifies the Stripe webhook and records the donation against the
  church's connected account.

**Acceptance criteria:**

- A completed one-time donation creates a `Donation` row (amount, currency,
  status `paid`) linked to the church's `PaymentAccount` and the customer.
- A monthly donation creates a `DonationSubscription` and the provider
  confirms it; installments become confirmed donations via the payment sync.
- Payments reach the church's own Stripe connected account.
- Repeated or out-of-order webhooks are deduplicated (idempotent).
- No raw card data is stored in PRAYER.
- The Stripe integration is flagged `STRIPE_ENABLED` and returns a clear
  "not ready" state while the provider stub is unfilled.

> Note: The backend Stripe integration is **already planned in the admin docs**
> (`docs/TASK.md` F8DO + X-MOB: DO-02/05/06/08, MB-02/03) and is not rebuilt
> for the website. The website only builds the donate/result UI on top of the
> shared donation controller. WF4 is blocked until those shared backend items
> land — see `SPEC.md` section 6.2 and `docs/website/TASK.md` WB-40..WB-44.

## Shared technical and delivery requirements

| Requirement | Required support                                                                         |
| ----------- | ---------------------------------------------------------------------------------------- |
| Security    | Encrypted transport, secure password handling, restricted DB access, no card data stored |
| Privacy     | Only access data the customer owns or is public; do not log private content              |
| Languages   | en/et/sv/fi interface; independent of church country                                     |
| Testing     | Route-level tests, account flow tests, payment webhook tests                             |
| Handover    | Same repo handover as the admin/repo docs (schema, env, runbook)                         |

## Out of scope / Future (do not build now)

- Events, services, announcements.
- Prayer / pastoral / meeting request forms.
- Voluntary check-in.
- Push notifications, device registration, data exports, in-site account
  deletion.
- Guest / unauthenticated browsing of content (sign-in required for all).
- Staff or admin capabilities.

Recording an item here is not a recommendation to build it later; evaluate any
future addition against a confirmed business need.

## Summary

The website has four features: User Onboarding, Church Directory, Prayer, and
Donations. Onboarding, directory, and Prayer reuse existing backend
controllers. Donations are website UI only — they reuse the Stripe backend
already planned in the admin TASK (DO-02/05/06, MB-02/03); WF4 is testable only
once that shared backend lands.
