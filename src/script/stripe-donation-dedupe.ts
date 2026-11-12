/* eslint-disable no-console -- ops CLI: prints the plan and the verdict on stdout */

/*
 * One-off repair for donation rows that were keyed on the wrong Stripe object.
 *
 * Before the ledger-key fix, a monthly gift landed twice: the checkout redirect
 * wrote the `cs_…` session id and `invoice.payment_succeeded` wrote the `in_…`
 * invoice id, because neither the session (subscription mode) nor the invoice
 * (API 2025-03-31) exposes a top-level payment intent any more. Both rows then
 * counted toward the church's confirmed amount.
 *
 *   bun src/script/stripe-donation-dedupe.ts                  # dry run, prints the plan
 *   bun src/script/stripe-donation-dedupe.ts --apply          # merges + re-keys
 *   bun src/script/stripe-donation-dedupe.ts --church <id>    # one parish only
 *
 * Canonical key per Stripe: the invoice's settled payment intent. Every group
 * keeps one row (the one already keyed canonically, else the earliest), carries
 * the highest refunded amount and earliest paid date, and deletes the twins.
 * Reads only unless --apply. Requires STRIPE_ENABLED=true plus a secret key, and
 * the database the rows live in.
 */
import { parseArgs } from 'node:util'

import { db } from '@/utils/db-connection'
import { STRIPE, isStripeEnabled } from '@/providers/stripe'
import { RESOLVE_INVOICE_PAYMENT_ID } from '@/utils/stripe-payment-id'
import { planDonationDedupe, type DonateDedupeRow } from './stripe-donation-dedupe-rules'

const HELP = `Dedupe donation rows created before the Stripe ledger key was fixed.

Usage: bun src/script/stripe-donation-dedupe.ts [options]

  --apply               Write the changes (default: dry run)
  --church <uuid>       Restrict to one church
  --limit <n>           Max suspect rows to inspect (default 500)
  -h, --help            Show this help

Suspect rows are cs_… (checkout session) and in_… (invoice) keys. Each is
resolved through Stripe to its settled payment intent (pi_…); rows that resolve
to the same payment are merged into one and re-keyed.`

const { values: opt } = parseArgs({
  options: {
    apply: { type: 'boolean', default: false },
    church: { type: 'string' },
    limit: { type: 'string', default: '500' },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

/** Stripe id → settled payment intent, or null when it cannot be resolved. */
const resolveCanonicalId = async (
  providerPaymentId: string,
): Promise<{ canonicalId: string | null; error?: string }> => {
  if (providerPaymentId.startsWith('pi_')) return { canonicalId: providerPaymentId }
  try {
    if (providerPaymentId.startsWith('in_')) {
      const invoice = await STRIPE.retrieveInvoice(providerPaymentId)
      return { canonicalId: RESOLVE_INVOICE_PAYMENT_ID(invoice) ?? null }
    }
    if (providerPaymentId.startsWith('cs_')) {
      const session = await STRIPE.retrieveCheckoutSession(providerPaymentId)
      if (session.payment_intent) return { canonicalId: session.payment_intent }
      if (!session.invoice) return { canonicalId: null, error: 'session has no invoice' }
      const invoice = await STRIPE.retrieveInvoice(session.invoice)
      return { canonicalId: RESOLVE_INVOICE_PAYMENT_ID(invoice) ?? null }
    }
  } catch (error) {
    return { canonicalId: null, error: error instanceof Error ? error.message : String(error) }
  }
  return { canonicalId: null, error: 'unknown provider id prefix' }
}

const main = async () => {
  if (opt.help) return console.log(HELP)
  if (!isStripeEnabled()) {
    console.error('STRIPE_ENABLED is not true; set it to resolve ids against Stripe.')
    process.exitCode = 1
    return
  }

  const limit = Number(opt.limit)
  if (!Number.isInteger(limit) || limit < 1) {
    console.error(`--limit must be a positive integer, got '${opt.limit}'`)
    process.exitCode = 1
    return
  }

  const rows = await db.donation.findMany({
    where: {
      church_id: opt.church,
      OR: [
        { provider_payment_id: { startsWith: 'cs_' } },
        { provider_payment_id: { startsWith: 'in_' } },
      ],
    },
    select: {
      id: true,
      provider_payment_id: true,
      church_id: true,
      amount_minor: true,
      refunded_minor: true,
      currency: true,
      status: true,
      paid_at: true,
      created_at: true,
    },
    orderBy: { created_at: 'asc' },
    take: limit,
  })

  if (rows.length === 0) {
    console.log('No cs_/in_ keyed donations found. Nothing to do.')
    return
  }

  const resolutions = new Map<string, { canonicalId: string | null; error?: string }>()
  for (const row of rows) {
    const key = row.provider_payment_id
    if (!resolutions.has(key)) resolutions.set(key, await resolveCanonicalId(key))
  }

  const plan = planDonationDedupe(
    rows.map((row): DonateDedupeRow => ({
      id: row.id,
      providerPaymentId: row.provider_payment_id,
      churchId: row.church_id,
      amountMinor: row.amount_minor,
      refundedMinor: row.refunded_minor,
      currency: row.currency,
      status: row.status,
      paidAt: row.paid_at,
      createdAt: row.created_at,
    })),
    (row) => resolutions.get(row.providerPaymentId) ?? { canonicalId: null },
  )

  const byId = new Map(rows.map((row) => [row.id, row]))
  for (const group of plan.groups) {
    const keeper = byId.get(group.keeperId)
    const merged = group.deleteIds.map((id) => byId.get(id)?.provider_payment_id ?? id)
    console.log(
      `keep ${keeper?.provider_payment_id} (${keeper?.currency.toUpperCase()} ${
        Number(keeper?.amount_minor ?? 0) / 100
      }) -> ${group.canonicalId}; merge ${merged.join(', ') || 'nothing'}`,
    )
  }
  for (const { row, reason } of plan.unresolved) {
    console.log(`skip ${row.providerPaymentId}: ${reason}`)
  }

  const deletions = plan.groups.reduce((sum, group) => sum + group.deleteIds.length, 0)
  console.log(
    `\n${plan.groups.length} payment group(s), ${deletions} duplicate row(s) to delete, ${plan.unresolved.length} unresolved.`,
  )
  if (!opt.apply) {
    console.log('Dry run. Re-run with --apply to write.')
    return
  }

  for (const group of plan.groups) {
    await db.$transaction(async (tx) => {
      if (group.deleteIds.length > 0) {
        await tx.donation.deleteMany({ where: { id: { in: group.deleteIds } } })
      }
      await tx.donation.update({
        where: { id: group.keeperId },
        data: {
          provider_payment_id: group.canonicalId,
          refunded_minor: group.keeper.refundedMinor,
          paid_at: group.keeper.paidAt,
        },
      })
    })
    console.log(`applied ${group.canonicalId}`)
  }
}

main()
  .catch((error: unknown) => {
    console.error(`FAILED: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
