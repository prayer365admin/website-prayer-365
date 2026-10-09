# Stripe Integration Guide

This document outlines the Stripe webhook and payment integration (SPEC §9.6, TASK F8DO).

## Architecture

- **Single Platform Account:** All church donations settle into **one centralized PRAYER-owned Stripe platform account**. Stripe Connect and per-church accounts are not used.
- **Payouts:** External and manual by administrators outside this dashboard. The dashboard contains no payout, transfer, or balance UI and calls no Stripe payout APIs.
- **Church Attribution:** Because all transactions occur on the platform account, donation flows MUST attach `churchId` to Stripe `metadata` (e.g. `metadata.churchId`).
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
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe --events payment_intent.succeeded,payment_intent.payment_failed,checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,charge.succeeded,charge.refunded
```

When you start listening, the Stripe CLI will output a webhook signing secret (`whsec_...`). **Copy this secret and update your `STRIPE_WEBHOOK_SECRET` in `.env`**, then restart your development server.

### Testing Events with Church Metadata

When triggering test events with the Stripe CLI, include `metadata[churchId]` to test successful donation attribution:

```bash
stripe trigger payment_intent.succeeded --override "payment_intent:metadata[churchId]=<approved-church-uuid>"
```

Events triggered without valid church metadata will be persisted as receipts with state `IGNORED_UNATTRIBUTABLE` and will not produce donation records.

## Listened Webhook Events

The webhook endpoint idempotently stores webhook receipts and pushes a `payment.sync` job to the outbox for background processing. While it safely logs any valid Stripe event you send it, the system explicitly forwards and expects these core payment lifecycle events:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.succeeded`
- `charge.refunded`

## API Routes

- **`POST /api/v1/webhooks/stripe`**
  - **Description**: Ingests Stripe webhook events, verifies HMAC signatures using the platform `STRIPE_WEBHOOK_SECRET`, enforces idempotency, ignores events from unconfigured sources or missing church attribution (without modifying church records), and queues `payment.sync` background jobs for transactional data sync.
  - **Success Response**: `200 OK` (Acknowledged and queued)
  - **Error Responses**:
    - `400 Bad Request` (Invalid JSON payload or Invalid signature/timestamp mismatch)
    - `500 Internal Server Error` (Missing webhook secret configuration)
