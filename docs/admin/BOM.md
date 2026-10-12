# Prayer Admin + Shared Backend — BOM

Created: September 24, 2026. Currency: USD unless explicitly stated otherwise.

This Bill of Materials records the service budget discussed on September 23, 2026. Non-voice provider prices were checked on that date. ElevenLabs API pricing and the single-account voice budget were refreshed on September 24, 2026. Ranges are planning allowances, not fixed quotations. Taxes, development labor, maintenance labor, and donation transaction fees are excluded.

The Next.js backend serves both the admin dashboard and mobile app. Shared services are counted here once.

## 1. Budget Assumptions

| Item                    | Assumption                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| Launch size             | 10 churches and 1,000 monthly active users                                                              |
| Prayer generation       | One prayer per church daily, averaging 2,000 characters                                                 |
| Monthly generation      | 600,000 characters over 30 days, plus 20% retries: 720,000 characters                                   |
| Languages               | Generation assumption counts one audio version per prayer; additional language versions increase usage. |
| Media                   | Approximately 20 GB stored and 100 GB delivered monthly                                                 |
| Email                   | Approximately 5,000 transactional emails monthly                                                        |
| Environments            | Small production environment plus lightweight staging                                                   |
| Database                | Small managed PostgreSQL instance; no standby replica in this allowance                                 |
| Region and connectivity | Final hosting region and secure database connectivity remain to be selected.                            |
| Account ownership       | Client-owned infrastructure; exactly one PRAYER ElevenLabs account for all pastor voices                |
| Voice onboarding        | Pastor self-upload in PRAYER, admin approval, then automatic Instant Voice Cloning API registration     |

## 2. Admin and Shared Services BOM

| Component                         | Proposed solution                                                                         | Monthly estimate | Basis                                                                                                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------- | ---------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework and RBAC libraries      | Next.js, Ant Design, Prisma, existing authorization libraries                             |  $0 license cost | Implementation work is separate.                                                                                                                                                                                   |
| Dashboard and API hosting         | [Vercel Pro](https://vercel.com/pricing)                                                  |          $20–$60 | Starts at $20; allowance for deployment seats and usage. Church staff are not Vercel deployment seats.                                                                                                             |
| Database and backups              | [Managed PostgreSQL / AWS RDS](https://aws.amazon.com/rds/postgresql/pricing/)            |          $40–$90 | Planning allowance for a small database without a standby replica.                                                                                                                                                 |
| Background processing             | [AWS Fargate](https://aws.amazon.com/fargate/pricing/), queues, scheduler                 |          $15–$35 | Planning allowance for audio jobs, publication, and notifications.                                                                                                                                                 |
| Media storage and delivery        | [AWS S3](https://aws.amazon.com/s3/pricing/)                                              |          $10–$25 | Storage, requests, and media bandwidth allowance.                                                                                                                                                                  |
| Logs and secrets                  | AWS CloudWatch / Secrets Manager                                                          |          $15–$35 | Planning allowance.                                                                                                                                                                                                |
| Network services                  | Connectivity and outbound traffic                                                         |          $30–$80 | Planning allowance, excluding media delivery already counted above.                                                                                                                                                |
| Transactional email               | [Amazon SES](https://aws.amazon.com/ses/pricing/)                                         |            $1–$5 | Approximately 5,000 emails; production transport integration required.                                                                                                                                             |
| Staging resources                 | Separate test services                                                                    |          $20–$50 | Incremental lightweight environment allowance.                                                                                                                                                                     |
| AI voice registration and audio   | [ElevenLabs API Pro](https://elevenlabs.io/pricing/api) — provisional single-account plan |              $99 | Published API plan includes 990,000 v3 TTS characters/month, covering the assumed 720,000. Validate IVC access, at least 10 voice slots, verification handling and production model eligibility before purchasing. |
| **Admin/shared monthly subtotal** |                                                                                           |    **$250–$479** | **Includes one PRAYER voice account.**                                                                                                                                                                             |

Hosting is proposed, not provisioned. The SPEC still requires a secure Vercel-to-PostgreSQL connectivity decision. Enterprise private connectivity, a different deployment topology, or redundant database infrastructure requires a revised estimate; the network allowance is not a quotation for those options.

## 3. Additional and Variable Costs

| Item                                  |                Estimate | Treatment                                                                                                         |
| ------------------------------------- | ----------------------: | ----------------------------------------------------------------------------------------------------------------- |
| Individual pastor ElevenLabs accounts |                      $0 | Not part of the selected flow; all profiles are managed under the PRAYER account.                                 |
| Domain                                |  $15–$30/year allowance | Depends on domain and registrar.                                                                                  |
| Donation transactions                 |             Usage-based | Depends on church country, payment method, currency, and provider setup. Excluded from totals.                    |
| Stripe Connect and recurring billing  | Configuration-dependent | Confirm charge model, payout fees, and any recurring-billing charges before launch. Excluded from totals.         |
| Development and ongoing support       |      Separate quotation | Includes design, mobile/admin implementation, QA, deployment, and maintenance. Team rates have not been supplied. |

Pastors upload samples in PRAYER. Admin approval triggers registration through the Instant Voice Cloning API using PRAYER’s credentials. The previous $220/month reserve for personal pastor accounts is removed. Admin approval does not waive provider verification. [IVC API](https://elevenlabs.io/docs/api-reference/voices/ivc/create).

At the published v3 API rate of $0.10 per 1,000 characters, 720,000 characters represents $72 of generation usage. This is a usage comparison, not an additional charge on top of included subscription usage. We budget $99 for the provisional Pro plan. Any required increase in voice-slot capacity or provider commercial terms must be priced before commitment. [API pricing](https://elevenlabs.io/pricing/api).

For illustration, Stripe Estonia lists **1.5% + EUR 0.25** for standard EEA cards. This is retained in the provider's billing currency and is not included in USD totals. Other cards, currency conversion, Connect, and recurring billing can incur additional fees. Sources: [Stripe payment pricing](https://stripe.com/en-ee/pricing), [Stripe Connect pricing](https://stripe.com/en-ee/connect/pricing).

## 4. Combined Mobile + Admin Budget

| Cost category                            |          Estimate |
| ---------------------------------------- | ----------------: |
| Mobile monthly services                  |           $19–$39 |
| Admin/shared monthly services            |         $250–$479 |
| Individual pastor accounts               |                $0 |
| **Monthly subtotal**                     |     **$269–$518** |
| 20% contingency, rounded                 |          $54–$104 |
| **Recommended monthly budget, rounded**  |     **$350–$650** |
| Annual Apple membership and domain       |         $114–$129 |
| One-time Google Play registration        |               $25 |
| **First-year operating budget, rounded** | **$4,339–$7,954** |

First-year budget uses the recommended rounded monthly budget × 12, plus annual fees and Google registration. It includes one PRAYER API subscription and contingency, but excludes taxes, donation fees, and labor.

The mobile costs come from [Prayer Mobile BOM](../prayer-mobile-app/BOM.md). They are already included above; do not add them a second time.

## 5. Cost Controls and Open Decisions

- Generate each approved prayer once and serve the saved audio to all listeners. More listeners increase delivery costs; additional prayers, languages, and regenerations increase AI usage.
- Validate voice quality, language support, API character consumption, IVC voice-slot capacity and provider verification handling before selecting the final subscription.
- Confirm hosting region, database size, recovery requirements, and secure connectivity before committing infrastructure spend.
- Configure usage alerts and review actual costs after launch. Contingency is a reserve, not a spending cap.
- This BOM budgets the documented scope and does not add Future Approach features.
