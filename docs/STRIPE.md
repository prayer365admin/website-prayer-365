# Stripe Integration Guide

This document outlines the Stripe webhook integration for DO-05, responsible for handling payment and subscription events securely.

## Configuration (Environment Variables)

The following environment variables are required in your `.env` (or `.env.local`) file for the Stripe webhook endpoint to process incoming requests properly:

```env
# Feature flag to enable/disable Stripe integration (must be 'true' for webhooks to be processed)
STRIPE_ENABLED=true

# Stripe Webhook Signing Secret (starts with 'whsec_')
# Used to verify the integrity and authenticity of the payload.
STRIPE_WEBHOOK_SECRET=whsec_...
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
  - **Description**: Ingests Stripe webhook events, verifies HMAC signatures using `STRIPE_WEBHOOK_SECRET`, enforces idempotency, prevents unknown-account creation, and queues `payment.sync` background jobs for transactional data sync.
  - **Success Response**: `200 OK` (Acknowledged and queued)
  - **Error Responses**:
    - `400 Bad Request` (Invalid JSON payload or Invalid signature/timestamp mismatch)
    - `500 Internal Server Error` (Missing webhook secret configuration)
