# Stripe Integration Guide

This document outlines the Stripe webhook and payment integration (SPEC §9.6, TASK F8DO).

## Architecture

- **Single Platform Account:** All church donations settle into **one centralized PRAYER-owned Stripe platform account**. Stripe Connect and per-church accounts are not used.
- **Payouts:** External and manual by administrators outside this dashboard. The dashboard contains no payout, transfer, or balance UI and calls no Stripe payout APIs.
- **Church Attribution:** Because all transactions occur on the platform account, donation flows MUST attach `churchId` to Stripe `metadata` (e.g. `metadata.churchId`).
- **Account Resolution:** Incoming events resolve their account from `event.account`, falling back to `data.object.account`, then to `STRIPE_PLATFORM_ACCOUNT_ID` (the normal case for single-account webhooks). An unset `STRIPE_PLATFORM_ACCOUNT_ID` makes every webhook fail with 500 `STRIPE_PLATFORM_ACCOUNT_ID_MISSING` until configured.
- **Isolation & Protection:** Webhook events without a resolvable, approved `churchId` or from unconfigured sources are recorded as durable receipts for audit but **never** create donation rows or affect church records.

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

## Donation Initiation (admin)

Checkout initiation is exposed through the donation controller (`initiateDonation`) and will be wired to a route in the mobile/API phase (MB-02). Behavior contract:

- Input: `amountMinor` (positive integer), `currency` (3-letter code), `frequency` (`one_time` | `monthly`), optional `successUrl` / `cancelUrl` (hardcoded `app.prayer.com` fallbacks until D6 finalizes URLs).
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
