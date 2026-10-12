# PRAYER Customer-Facing Website — Bill of Materials (BOM)

| Field    | Value                                                               |
| -------- | ------------------------------------------------------------------- |
| Version  | 0.1 (draft)                                                         |
| Date     | 12 October 2026                                                     |
| Author   | Product / Platform engineering                                      |
| Approver | [TBD]                                                               |
| Currency | USD unless stated. Donation fees remain in the provider's currency. |

This document records the **incremental** service cost of the customer-facing
website. The website is a new public route group inside
`prayer-365-dashboard`, so it shares the hosting, database, media, email, and
background-processing services already budgeted in `docs/BOM.md` (the admin +
shared backend BOM). Those shared line items are **counted once and not
re-billed here**.

## 1. Budget assumptions

| Item                 | Assumption                                                         |
| -------------------- | ------------------------------------------------------------------ |
| Launch size          | 10 churches, 1,000 monthly active users (shared with mobile/admin) |
| Website donors       | Small early donor base (~20–50 donors/month), USD and EUR early    |
| Donations            | One-time + monthly recurring per church account                    |
| Languages            | en/et/sv/fi interface (matches mobile)                             |
| Media                | Shares the existing ~20 GB stored / ~100 GB delivered allowance    |
| Hosting / DB / email | Shared with the admin BOM; no new instance                         |
| Environment          | Same production/staging as the admin app (separate public domain)  |

## 2. Website services — delta vs shared BOM

| Component                    | Proposed solution                                     | Monthly estimate | Basis                                                        |
| ---------------------------- | ----------------------------------------------------- | ---------------: | ------------------------------------------------------------ |
| Website + admin hosting      | Same Next.js/Vercel app (new `(site)` routes)         |   $0 incremental | Shared process; shared plan allowance.                       |
| Database                     | Same managed PostgreSQL                               |   $0 incremental | No new schema/tables.                                        |
| Media                        | Same S3 bucket (public-read, approved prayers)        |           $0–$10 | Slight prayer-audio delivery growth on the shared allowance. |
| Transactional email          | Same SES/Nodemailer (verify/reset)                    |            $0–$1 | In shared 5,000/month email allowance.                       |
| Background jobs (payments)   | Same scheduler/worker path (`payment.sync`)           |   $0 incremental | Reuses admin worker.                                         |
| Stripe + Stripe Connect      | Provider/usage — one-time + subscriptions, per church |      Usage-based | See §3; not included in the subtotal.                        |
| **Website monthly subtotal** |                                                       |       **$0–$11** | Incremental above the shared admin BOM.                      |

Hosting, database, media, email, and background processing are shared and
already covered by the admin/shared BOM (`docs/BOM.md`, subtotal $250–$479/mo).
The website only adds a small media-deltivery margin above that number.

## 3. Donation transaction costs (variable)

| Item                            | Treatment                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| One-time card payments          | Usage-based; standard EEA example ~1.5% + EUR 0.25 (Stripe Estonia, unchanged)     |
| Monthly/recurring subscriptions | Configuration-dependent; recurring-billing and Connect fees vary by country/method |
| Currency conversion             | Usage-based; fees apply where currencies differ                                    |

Donation fees are paid by the church/provider per transaction and are
**excluded** from the website service totals. Full pricing is confirmed with
Stripe by country before enabling `STRIPE_ENABLED`.

## 4. One-off and other costs

| Item                      | Estimate           | Treatment                                                      |
| ------------------------- | ------------------ | -------------------------------------------------------------- |
| Customer-facing domain    | $10–$20/year       | Separate customer domain; registrar-dependent                  |
| Translation (en→et/sv/fi) | Team effort, [TBD] | Website UI strings; mirrors mobile keys; labour, not a service |
| Development labour        | Separate quotation | Not included here                                              |

## 5. Cost controls and open decisions

- Enable Stripe only after the shared backend donation launch + webhook land and
  pass testing (admin TASK DO-02/05/06, MB-02/03 — not website-side work); the
  donate button stays disabled while `STRIPE_ENABLED !== 'true'`.
- Set usage alerts on media delivery and donation volumes; review after launch.
- Shared services should NOT be duplicated. Any new hosting/DB/email for the
  website would raise the shared BOM and must be agreed first.
- Open decisions: Stripe Connect account onboarding and fees (W3), payment
  model/currencies (W2), campaign/email volumes, translated-content strategy.

## Summary

The website adds little service cost because it reuses the admin/shared
infrastructure. Incremental spend is roughly **$0–$11/month** plus variable
Stripe transaction fees and a customer domain. The main cost driver is
development labour (donation backend + UI) and translations, not monthly
services.
