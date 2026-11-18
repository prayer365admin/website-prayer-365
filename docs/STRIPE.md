# Stripe Integration Guide

This document outlines the Stripe webhook and payment integration (SPEC §9.6, TASK F8DO).

## Architecture

- **Single Platform Account:** All church donations settle into **one centralized PRAYER-owned Stripe platform account**. Stripe Connect and per-church accounts are not used.
- **Payouts:** External and manual by administrators outside this dashboard. The dashboard contains no payout, transfer, or balance UI and calls no Stripe payout APIs.
- **Church Attribution:** Because all transactions occur on the platform account, donation flows MUST attach `churchId` to Stripe `metadata` (e.g. `metadata.churchId`).
- **Ministry Designation:** The giver's chosen purpose (`category`: `general` | `pantry` | `organ` | `youth`, from the W11 "Designate Ministry Purpose" grid) rides in `metadata.category` on the Checkout Session **and** on the payment intent / subscription metadata, so a parish can filter gifts by ministry directly in Stripe. Omitted → no `category` key (mobile/API callers that predate the field).
- **Account Resolution:** Incoming events resolve their account from `event.account`, falling back to `data.object.account`, then to `STRIPE_PLATFORM_ACCOUNT_ID` (the normal case for single-account webhooks). An unset `STRIPE_PLATFORM_ACCOUNT_ID` makes every webhook fail with 500 `STRIPE_PLATFORM_ACCOUNT_ID_MISSING` until configured.
- **Isolation & Protection:** Webhook events without a resolvable, approved `churchId` or from unconfigured sources are recorded as durable receipts for audit but **never** create donation rows or affect church records.

## Platform Beneficiary (guest giving, `/give`)

A visitor without an account can give from `/give`. That gift goes to **Prayer 365 itself**, never to a
parish, and it reuses the existing checkout controller and webhook unchanged.

- **The row.** A single hidden system church is seeded: `slug = prayer365`, `name = 'Prayer 365'`,
  `status = APPROVED`, `is_platform = true` (`prisma/seeds/platform-church.ts`, idempotent, part of
  `bunx prisma db seed`). It is identified in code by `PLATFORM_CHURCH_SLUG`
  (`src/config/platform-church.ts`) and resolved server-side at runtime, so staging and production can
  keep different row ids. The migration `20261116090000_platform_church_row` inserts the row as soon as
  its org node exists, so a deployed database serves `/give` before the first seed; `bunx prisma db seed`
  remains the idempotent source of truth, and it refuses to convert a parish that already owns the slug.
- **Why `metadata.churchId` still carries an id.** The `payment.sync` worker skips every event without a
  `churchId` (`src/controller/payment-sync-job.tsx`), so a null-church gift would be silently dropped —
  no ledger row, no reconciliation. The platform row satisfies the attribution contract; nothing in the
  webhook, the ledger shape or the reports changes. No `metadata.userId` is written and
  `donations.user_id` stays `NULL`.
- **What `/give` writes.** One-time gifts only (`frequency: 'one_time'`, `mode: 'payment'`), EUR, presets
  5/10/25/50 plus a custom amount between 1 and 5,000 EUR. No `category` key, no subscription. The page
  carries no parish selector: the beneficiary cannot be named by the browser.
- **The two public routes** (unauthenticated, like the rest of the `site/**` family they are absent from
  the OpenAPI registry):
  - **`POST /api/v1/site/donations/public`** — body is exactly `{ amountMinor, currency: 'eur', frequency: 'one_time' }`
    (strict). `successUrl`/`cancelUrl` are built server-side from `SITE_URL`, so a body naming a church, a
    return URL or a monthly frequency is a `422`. No `Idempotency-Key`: a guest has no actor to key one on,
    and a duplicate session simply expires unpaid. Returns `503 DONATIONS_NOT_READY` when the platform row
    is missing (run the seed) or the integration is disabled.
  - **`GET /api/v1/site/donations/public/status?sessionId=cs_…`** — the outcome, `Cache-Control: private, no-store`.
    A session that is not the platform's own, is absent, or is not `payment` mode answers `404`, so an
    anonymous caller cannot probe another giver's outcome by session id, and a disabled integration answers
    `503 DONATIONS_NOT_READY` rather than `404` so a broken link and an outage render differently. Status
    rules mirror the signed-in read: a live session outranks a FAILED ledger row, `paid` is
    `paymentStatus === 'paid'`, `failed` only when the session is expired and the row is FAILED, and a
    `REFUNDED` ledger row reports `refunded` — it outranks the session, because Stripe keeps
    `paymentStatus = 'paid'` after a refund. The amount and `paidAt` are read from the ledger (never
    minted), so both are `null` until the webhook lands.
- **Reading guest giving.** These gifts are the platform's own revenue, so they are **not** in any parish
  report and the parish donation routes answer `403` for the platform row (its org node sits outside the
  parish scope tree on purpose). They are read at central scope with `prayer_donation` read:
  - **`GET /api/v1/admin/central/donations`** — paginated `from`/`to`/`currency` ledger of guest gifts
    (amount, currency, state, date, provider ref; no donor PII), `Cache-Control: private, no-store`.
  - **`GET /api/v1/admin/central/donation-summary?month=YYYY-MM`** — per-currency gross/refunded/net for
    that month, same no-cross-currency rule as the parish summary.
  - **`/dashboard/central/donations`** ("Platform Giving" in the Central menu, shown only to callers who can
    read donations) renders both: a transactions table and the monthly summary.
  - Both routes answer `503 DONATIONS_NOT_READY` when the platform row is missing (run the seed), never an
    empty report — an empty ledger and a missing beneficiary must not look the same.
- **Admin protection.** The row appears in the central church list as one more beneficiary but is
  read-only: `updateChurch`, `suspendChurch`, `archiveChurch`, `unarchiveChurch` and `purgeChurch` refuse it
  with `403 SYSTEM_RECORD_PROTECTED`, and every public directory surface filters `is_platform: false`. The
  FK from `donations.church_id` (RESTRICT) is the second line of defence once gifts exist.
- **Receipts.** Stripe Checkout collects the guest's email and **Stripe** sends the receipt. Prayer 365
  sends no receipt mail for these gifts and the thank-you page says so. Receipt emails must be enabled in
  the Stripe dashboard.

## Configuration (Environment Variables)

The following environment variables are required in your `.env` (or `.env.local`) file for the Stripe webhook endpoint to process incoming requests properly:

```env
# Feature flag to enable/disable Stripe integration (must be 'true' for webhooks to be processed)
STRIPE_ENABLED=true

# Stripe Webhook Signing Secret (starts with 'whsec_')
# Verifies the HMAC signature of incoming webhooks on the single platform account.
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Platform Secret Key (starts with 'sk_test_' or 'sk_live_') - for checkout/payment initiation
STRIPE_SECRET_KEY=sk_test_...

# Stripe Platform Account ID (starts with 'acct_')
# Identifies the single centralized platform account for webhook attribution fallback.
STRIPE_PLATFORM_ACCOUNT_ID=acct_...
```

## Local Development & Webhook Forwarding

To test webhooks locally without exposing your local environment to the public internet, use the Stripe CLI. We have configured a script in `package.json` that forwards only the necessary events to your local server.

Start your local Next.js server on port 3000:

```bash
bun run dev
```

In a separate terminal, run the Stripe listen command:

```bash
bun run stripe:listen
```

This runs the following under the hood:

```bash
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe --events payment_intent.succeeded,payment_intent.payment_failed,checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,charge.succeeded,charge.failed,charge.refunded,invoice.payment_succeeded,invoice.payment_failed
```

When you start listening, the Stripe CLI will output a webhook signing secret (`whsec_...`). **Copy this secret and update your `STRIPE_WEBHOOK_SECRET` in `.env`**, then restart your development server.

### Testing Events with Church Metadata

When triggering test events with the Stripe CLI, include `metadata[churchId]` to test successful donation attribution:

```bash
stripe trigger payment_intent.succeeded --override "payment_intent:metadata[churchId]=<approved-church-uuid>"
```

Events triggered without valid church metadata will be persisted as receipts with state `IGNORED_UNKNOWN_ACCOUNT` and will not produce donation records.

## Receipt & Job Lifecycle

Every accepted webhook is persisted as a `webhook_receipts` row and, for syncable events, a matching `payment.sync` outbox job — written in one transaction (ack-after-durable-accept, SPEC §8.5).

**Receipt states:**

| State                     | Meaning                                                                         |
| ------------------------- | ------------------------------------------------------------------------------- |
| `PENDING`                 | Accepted; outbox job queued, worker not finished yet.                           |
| `PROCESSED`               | Job succeeded (or event needed no sync, e.g. `checkout.session.completed`).     |
| `FAILED`                  | Job exhausted its retry budget.                                                 |
| `IGNORED_UNKNOWN_ACCOUNT` | Event account did not resolve to the platform account; recorded for audit only. |

**Retry semantics:**

- Stripe redelivers an event whose receipt is `FAILED` => the receipt and its job are re-armed (job reset to `PENDING`, attempts 0), so worker-side failures are recoverable by redelivery.
- Concurrent duplicate delivery of the same event => second request returns `duplicate: true`; no second job is created (unique `(provider, account_id, event_id)` + `P2002` catch).
- The `payment.sync` job claims with a lease; a worker crash releases the row for re-claim after lease expiry. Jobs requeue with exponential backoff and dead-letter after 3 attempts (`DONATION_NOT_FOUND` refund races get up to 10 attempts, since the refund event may arrive before the payment event).

Run the worker locally (polls every `PAYMENT_SYNC_WORKER_POLL_MS`, default 5000):

```bash
bun run worker:payment-sync
```

## Donation Attribution & Drift Correction

- Donations are keyed by `provider_payment_id` (globally unique); subscriptions by `provider_subscription_id`.
- If a later webhook event carries a different `metadata.churchId` than the stored row, the row's `church_id` is **reassigned to the incoming event's value** — provider events are the source of truth for attribution.
- State machine guards (enforced in `payment-sync` provider): a `PAID` donation is never downgraded to `FAILED` by a stale failure event; `refunded_minor` is monotonic (a late partial refund never lowers the cumulative total); a fully refunded donation flips to `REFUNDED`.
- **Ledger key is the payment intent** (`RESOLVE_INVOICE_PAYMENT_ID` in `src/utils/stripe-payment-id.ts`), resolved identically by the checkout redirect (`getDonationStatus`) and the webhook job. `CheckoutSession.payment_intent` exists only in `payment` mode, so a monthly session has none; `Invoice.payment_intent` was removed in API 2025-03-31 and the payment now lives in `Invoice.payments[].payment.payment_intent` (expand-only). Reading the legacy fields made one monthly gift land as two rows — a `cs_…` row from the redirect and an `in_…` row from `invoice.payment_succeeded` — which doubled the church's confirmed amount. The invoice id is used only when the invoice exposes no payment at all.
- Existing rows keyed `cs_…`/`in_…` are repaired once with `bun run stripe:donation-dedupe` (dry run by default; `--apply` merges twins, keeps the highest refunded amount and earliest paid date, and re-keys to the payment intent).

## Donation Initiation (admin)

Checkout initiation is exposed through the donation controller (`initiateDonation`) and will be wired to a route in the mobile/API phase (MB-02). Behavior contract:

- Input: `amountMinor` (positive integer), `currency` (3-letter code), `frequency` (`one_time` | `monthly`), optional `category` (`general` | `pantry` | `organ` | `youth` → `metadata.category` on the session and the payment intent / subscription), optional `successUrl` / `cancelUrl` (hardcoded `app.prayer.com` fallbacks until D6 finalizes URLs).
- Only `APPROVED` churches are eligible (`CHURCH_NOT_ELIGIBLE` otherwise); payloads containing raw card data are rejected with 422 `RAW_CARD_DATA_FORBIDDEN` before validation.
- Idempotency: send an `Idempotency-Key` header. Same actor+key+body replays the stored checkout session; same key with a different body returns 409 `IDEMPOTENCY_CONFLICT`; a concurrent in-flight request returns 409 `IDEMPOTENCY_IN_FLIGHT`. The external Stripe call runs **outside** any database transaction (`withExternalIdempotency`), so a slow Stripe call never holds a DB connection/lock.
- Session creation is a documented Phase-10 stub until the real Stripe SDK is wired.

## Listened Webhook Events

The webhook endpoint idempotently stores webhook receipts and pushes a `payment.sync` job to the outbox for background processing. While it safely logs any valid Stripe event you send it, the system explicitly forwards and expects these core payment lifecycle events:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.succeeded`
- `charge.failed`
- `charge.refunded`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Platform Account Model & Reporting Semantics (D6)

- **Single Platform Account:** All donations process through one PRAYER-owned Stripe platform account. Church attribution is established strictly via `metadata.churchId`.
- **Month Boundaries (D6):** Monthly summaries use UTC calendar month bounds `[start, end)` pending final local timezone resolution.
- **Per-Currency Reporting:** Money values are minor units (integers) and never aggregated across different currencies.
- **Subscription State Guard:** Canceled subscriptions are preserved against stale out-of-order non-terminal events. Non-terminal events (e.g., `past_due` vs `active`) overwrite based on incoming payload order pending finalization of D6 subscription lifecycle rules.

## API Routes

**Website (cookie session, subject-scoped, `Cache-Control: private, no-store`):**

- **`POST /api/v1/site/donations`** — starts a checkout. The body carries `churchId` plus `DonationInput` (`amountMinor`, `currency`, `frequency`, optional `category`); the giver comes from the session. A disabled integration returns `503 DONATIONS_NOT_READY`.
- **`POST /api/v1/site/donations/portal`** — mints a Stripe **billing portal** session so the giver pauses or changes their own pledge in Stripe (`billingPortal.sessions.create`). The subscription is resolved from the signed-in giver's newest `active` `DonationSubscription` and its Customer comes from `subscriptions.retrieve`, so no client-supplied subscription/customer id is ever trusted. Optional `returnPath` must stay on `/donate*` and is resolved against this origin. No active pledge → `404 NO_ACTIVE_SUBSCRIPTION`.
- **`GET /api/v1/site/donations/status`** — W12 attempt outcome read from our own ledger.
- **`POST /api/v1/site/donations/public`** / **`GET /api/v1/site/donations/public/status`** — the
  unauthenticated guest giving pair for `/give` (see "Platform Beneficiary" above).

**Mobile (bearer token, `Cache-Control: no-store`):**

- **`POST /api/v1/mobile/me/donation-attempts/:sessionId/expire`** — "start over": expires the caller's own **open** Checkout Session so its page can no longer be paid and the app can safely start a replacement. The session must carry the caller's `userId` in its metadata (else `404 DONATION_ATTEMPT_NOT_FOUND`). A session that is already `complete`/paid is never expired and answers `{ state: 'completed' }` (the app then reads the status, not a second payment); an already expired one answers `{ state: 'expired' }`. A race between our read and Stripe's expire call resolves to `completed`. Disabled integration → `503 DONATIONS_NOT_READY`.
- Checkout Sessions are created with `expires_at` = creation + 31 minutes (Stripe's minimum is 30), just past the 30-minute attempt window the status read honours, so abandoned pages close on their own.
- `GET …/donation-attempts` (and the site status read) answers from the ledger alone when a PAID/REFUNDED row exists; otherwise it reads the Stripe session through a 3-second per-instance cache (unpaid answers only) so polling cannot hammer the Stripe API.

**Reporting (all read-only, scoped by `requiredAuth` + `requiredScope` `prayer_donation` read, responses carry `Cache-Control: private, no-store`):**

- **`GET /api/v1/admin/churches/:churchId/donations`**
  - Paginated transaction list. Filters: `from`/`to` (ISO dates — matched against `paid_at`, with `created_at` fallback for failed rows that never received one), `currency`, pagination, ordering. Rows carry amount/currency/status/date/provider ref only — **no donor PII**.
- **`GET /api/v1/admin/churches/:churchId/donation-subscriptions`**
  - Paginated recurring-giving mirror (amount, currency, provider status). Read-only; installments appear in the transactions list, not here.
- **`GET /api/v1/admin/churches/:churchId/donation-summary?month=YYYY-MM`**
  - Per-currency gross/refunded/net for the month (UTC bounds). **Never sums across currencies.**

**Webhook:**

- **`POST /api/v1/webhooks/stripe`**
  - **Description**: Ingests Stripe webhook events, verifies HMAC signatures using the platform `STRIPE_WEBHOOK_SECRET`, enforces idempotency, ignores events from unconfigured sources or missing church attribution (without modifying church records), and queues `payment.sync` background jobs for transactional data sync.
  - **Success Response**: `200 OK` (Acknowledged and queued)
  - **Error Responses**:
    - `400 Bad Request` (Invalid JSON payload or Invalid signature/timestamp mismatch)
    - `500 Internal Server Error` (Missing webhook secret or platform account configuration)
