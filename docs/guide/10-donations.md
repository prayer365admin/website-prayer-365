# 10. Donations

> Part of: Admin Guidebook v1.0

## What this page is for

The donations page reports money the payment provider has confirmed for one church: transactions, recurring donations and a monthly summary. It is a reporting screen — money is never edited here.

## Who can use it

| Role                             | Can do                      |
| -------------------------------- | --------------------------- |
| Church admin with finance rights | Read the church's donations |
| Central / super admin            | Read any church's donations |
| Everyone else                    | No access                   |

## Before you start

- Open the church, then **Church → Donations**.
- Know this rule before reading numbers: **only provider-confirmed amounts count**. In the demo data the seeded donations have no confirmed provider state, so the totals are `0.00` while rows exist in the database. That is correct behaviour, not a bug.

## Step by step

### Step 1 — Read the header figures

![Donations page with the currency filter and the confirmed amount and count cards](assets/10-donations/01-donations-empty.png)

1. **Filter by currency** — amounts in different currencies are never added together.
2. **Confirmed amount** is the sum of confirmed payments in the selected currency.
3. **Donation count** is the number of confirmed payments.

### Step 2 — Read the transactions tab

1. The **Transactions** tab lists **Date, Reference, Amount / currency, Payment state**.
2. A row appears only when the provider confirms it.
3. The footer explains where refunds live: _"refunds and subscription editing are managed in Stripe."_

### Step 3 — Read recurring donations

Open the **Recurring** tab.

![Recurring donations tab with reference, amount, frequency and provider state](assets/10-donations/02-recurring.png)

1. Columns: **Reference, Amount / currency, Frequency, Provider state**.
2. `Active` means the subscription is running with the provider.
3. Nothing is editable here; changes happen in the provider's dashboard.

### Step 4 — Read the monthly summary

Open the **Monthly summary** tab.

![Monthly summary tab with month, currency, gross, refunded and net columns](assets/10-donations/03-monthly-summary.png)

1. Columns: **Month, Currency, Gross paid, Refunded, Net total**.
2. One row per month per currency.
3. Use it for reporting, not for reconciliation: the provider statement is the source of truth.

## Fields explained

| Field                             | What it means                      |
| --------------------------------- | ---------------------------------- |
| Currency filter                   | Limits all figures to one currency |
| Confirmed amount                  | Sum of confirmed payments          |
| Donation count                    | Number of confirmed payments       |
| Payment state                     | Provider state of the payment      |
| Frequency                         | One-off or recurring interval      |
| Gross paid / Refunded / Net total | Monthly totals from the provider   |

## What changes on the website

Donations are made **on** the website, not published **by** this page. The direction is one-way:

| Where              | What happens                                            |
| ------------------ | ------------------------------------------------------- |
| `/donate` (public) | Visitor chooses an amount and pays through the provider |
| Payment provider   | Confirms the payment and notifies the platform          |
| This page          | Shows the confirmed result                              |

Nothing typed or clicked here reaches a visitor. There is no public donor list and no public amount.

## Common problems

| Symptom                                           | Cause                                  | Fix                                                                     |
| ------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| Totals `0.00` but donations exist in the database | Payments are not provider-confirmed    | Test with a real test-mode payment (chapter 27 links the platform docs) |
| Recurring tab empty                               | No subscription for this church        | Expected on a church with one-off gifts only                            |
| Refund not visible                                | Refunds are managed by the provider    | Refund in Stripe, then wait for the sync                                |
| Currency switch shows different numbers           | Currencies are kept separate by design | Compare per currency, never across                                      |

Next: [11. My Voice](11-my-voice.md)
