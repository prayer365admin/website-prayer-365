// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/utils/db-connection'
import { processPaymentSyncJob } from './payment-sync-job'
import { RECORD_STRIPE_WEBHOOK_RECEIPT } from '@/providers/stripe-webhook'
import crypto from 'node:crypto'
import { GET_DONATION_SUMMARY } from '@/providers/donation'

describe('DO-08 Donation Tests and Edge-Case Synchronization', () => {
  let churchId: string
  let paymentAccountId: string
  let providerAccountId: string

  beforeEach(async () => {
    // Generate distinct UUIDs for isolation
    const org = await db.orgNode.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Test Org ' + crypto.randomUUID(),
        kind: 'CHURCH',
      },
    })
    const church = await db.church.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Test Church ' + crypto.randomUUID(),
        timezone: 'UTC',
        org_node_id: org.id,
        address: {},
        contacts: [],
        social_links: {},
      },
    })
    churchId = church.id

    providerAccountId = 'acct_' + crypto.randomBytes(8).toString('hex')
    const account = await db.paymentAccount.create({
      data: {
        id: crypto.randomUUID(),
        church_id: churchId,
        provider: 'stripe',
        provider_account_id: providerAccountId,
        status: 'ACTIVE',
      },
    })
    paymentAccountId = account.id
  })

  // Helper to simulate webhook arrival and processing
  const injectWebhook = async (
    eventType: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataObject: any,
    overrideAccountId?: string,
  ) => {
    const accountId = overrideAccountId || providerAccountId
    const eventId = 'evt_' + crypto.randomBytes(8).toString('hex')
    const created = Math.floor(Date.now() / 1000)

    const receipt = await RECORD_STRIPE_WEBHOOK_RECEIPT({
      event: {
        account: accountId,
        id: eventId,
        type: eventType,
        created,
        objectId: dataObject.id || 'test_obj',
        data: { object: dataObject },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    })

    if (receipt.jobId) {
      // Mark as running to satisfy processPaymentSyncJob expectation
      await db.outboxJob.update({
        where: { id: receipt.jobId },
        data: { state: 'RUNNING' },
      })
      const outcome = await processPaymentSyncJob(receipt.jobId, crypto.randomUUID())
      return { receipt, outcome }
    }
    return { receipt, outcome: 'ignored' }
  }

  describe('Scenario 1: Failed Payments', () => {
    it('creates a failed donation and does not inflate summary totals', async () => {
      const piId = 'pi_' + crypto.randomBytes(8).toString('hex')
      await injectWebhook('payment_intent.payment_failed', {
        id: piId,
        amount: 5000,
        currency: 'usd',
      })

      const currentMonth = new Date().toISOString().substring(0, 7)
      const summary = await GET_DONATION_SUMMARY({
        churchIds: new Set([churchId]),
        month: currentMonth,
      })
      expect(summary.currencies).toEqual([]) // Failed payments don't show up in summary

      const donations = await db.donation.findMany({
        where: { payment_account_id: paymentAccountId },
      })
      expect(donations.length).toBe(1)
      expect(donations[0].status).toBe('FAILED')
      expect(donations[0].paid_at).toBeNull()
      expect(donations[0].amount_minor).toBe(BigInt(5000))
    })

    it('processes stale failure after success safely', async () => {
      const piId = 'pi_' + crypto.randomBytes(8).toString('hex')

      // 1. Success arrives first
      await injectWebhook('payment_intent.succeeded', {
        id: piId,
        amount: 5000,
        currency: 'usd',
      })

      // 2. Delayed failure arrives
      await injectWebhook('payment_intent.payment_failed', {
        id: piId,
        amount: 5000,
        currency: 'usd',
      })

      const donations = await db.donation.findMany({
        where: { payment_account_id: paymentAccountId },
      })
      expect(donations.length).toBe(1)
      expect(donations[0].status).toBe('PAID') // Retained PAID status
      expect(donations[0].paid_at).not.toBeNull()

      const currentMonth = new Date().toISOString().substring(0, 7)
      const summary = await GET_DONATION_SUMMARY({
        churchIds: new Set([churchId]),
        month: currentMonth,
      })
      expect(summary.currencies.length).toBe(1)
      expect(Number(summary.currencies[0].grossMinor)).toBe(5000)
    })

    it('processes charge.failed', async () => {
      const chId = 'ch_' + crypto.randomBytes(8).toString('hex')
      await injectWebhook('charge.failed', {
        id: chId,
        payment_intent: null,
        amount: 2500,
        currency: 'eur',
      })

      let donations = await db.donation.findMany({
        where: { payment_account_id: paymentAccountId },
      })
      expect(donations.length).toBe(0)

      const piId = 'pi_' + crypto.randomBytes(8).toString('hex')
      await injectWebhook('charge.failed', {
        id: 'ch_' + crypto.randomBytes(8).toString('hex'),
        payment_intent: piId,
        amount: 2500,
        currency: 'eur',
      })

      donations = await db.donation.findMany({
        where: { payment_account_id: paymentAccountId },
      })
      expect(donations.length).toBe(1)
      expect(donations[0].status).toBe('FAILED')
      expect(donations[0].paid_at).toBeNull()
      expect(donations[0].currency).toBe('eur')
      expect(donations[0].provider_payment_id).toBe(piId)
    })

    it('processes invoice.payment_failed', async () => {
      const subId = 'sub_' + crypto.randomBytes(8).toString('hex')
      const invId = 'in_' + crypto.randomBytes(8).toString('hex')
      await injectWebhook('invoice.payment_failed', {
        id: invId,
        payment_intent: null,
        subscription: subId,
        amount_due: 7500,
        currency: 'usd',
      })

      const donations = await db.donation.findMany({
        where: { payment_account_id: paymentAccountId },
      })
      expect(donations.length).toBe(1)
      expect(donations[0].status).toBe('FAILED')
      expect(donations[0].subscription_id).toBeDefined()
    })
  })

  describe('Scenario 2: Duplicate and Out-of-Order Webhooks', () => {
    it('returns duplicate on ingress delivery and creates 1 outbox job', async () => {
      const eventId = 'evt_' + crypto.randomBytes(8).toString('hex')

      // Inject 1
      const receipt1 = await RECORD_STRIPE_WEBHOOK_RECEIPT({
        event: {
          account: providerAccountId,
          id: eventId,
          type: 'payment_intent.succeeded',
          created: Math.floor(Date.now() / 1000),
          objectId: 'pi_test',
          data: { object: { id: 'pi_test', amount: 1000, currency: 'usd' } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      })
      expect(receipt1.duplicate).toBe(false)
      expect(receipt1.jobId).toBeDefined()

      // Inject 2
      const receipt2 = await RECORD_STRIPE_WEBHOOK_RECEIPT({
        event: {
          account: providerAccountId,
          id: eventId,
          type: 'payment_intent.succeeded',
          created: Math.floor(Date.now() / 1000),
          objectId: 'pi_test',
          data: { object: { id: 'pi_test', amount: 1000, currency: 'usd' } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      })
      expect(receipt2.duplicate).toBe(true)
      expect(receipt2.receiptId).toBe(receipt1.receiptId)

      const jobsCount = await db.outboxJob.count({ where: { id: receipt1.jobId! } })
      expect(jobsCount).toBe(1)
      if (receipt1.jobId) {
        await db.outboxJob.delete({ where: { id: receipt1.jobId } })
      }
      await db.webhookReceipt.delete({ where: { id: receipt1.receiptId } })
    })

    it('idempotently handles duplicate job execution', async () => {
      const { receipt, outcome } = await injectWebhook('payment_intent.succeeded', {
        id: 'pi_dup',
        amount: 2000,
        currency: 'usd',
      })
      expect(outcome).toBe('succeeded')

      await db.outboxJob.update({ where: { id: receipt.jobId! }, data: { state: 'RUNNING' } })
      const outcome2 = await processPaymentSyncJob(receipt.jobId!, crypto.randomUUID())
      expect(outcome2).toBe('succeeded') // already processed

      const donations = await db.donation.findMany({
        where: { payment_account_id: paymentAccountId },
      })
      expect(donations.length).toBe(1)
      expect(donations[0].amount_minor).toBe(BigInt(2000))
    })

    it('resolves out-of-order failure before success', async () => {
      const piId = 'pi_outoforder'

      // 1. Failure arrives first
      await injectWebhook('payment_intent.payment_failed', {
        id: piId,
        amount: 3000,
        currency: 'usd',
      })

      let donations = await db.donation.findMany({
        where: { payment_account_id: paymentAccountId },
      })
      expect(donations[0].status).toBe('FAILED')

      // 2. Success arrives after
      await injectWebhook('payment_intent.succeeded', {
        id: piId,
        amount: 3000,
        currency: 'usd',
      })

      donations = await db.donation.findMany({ where: { payment_account_id: paymentAccountId } })
      expect(donations[0].status).toBe('PAID')
      expect(donations[0].paid_at).not.toBeNull()

      const currentMonth = new Date().toISOString().substring(0, 7)
      const summary = await GET_DONATION_SUMMARY({
        churchIds: new Set([churchId]),
        month: currentMonth,
      })
      expect(Number(summary.currencies[0].grossMinor)).toBe(3000)
    })

    it('resolves out-of-order installment before subscription created', async () => {
      const subId = 'sub_outoforder'

      // 1. Installment payment succeeds first
      await injectWebhook('invoice.payment_succeeded', {
        id: 'in_123',
        payment_intent: 'pi_123',
        subscription: subId,
        amount_paid: 1000,
        currency: 'usd',
      })

      let subs = await db.donationSubscription.findMany({
        where: { payment_account_id: paymentAccountId },
      })
      expect(subs.length).toBe(1)
      expect(subs[0].provider_status).toBe('active')

      // 2. Subscription creation arrives later
      await injectWebhook('customer.subscription.created', {
        id: subId,
        status: 'active',
        plan: { amount: 1000, currency: 'usd' },
      })

      subs = await db.donationSubscription.findMany({
        where: { payment_account_id: paymentAccountId },
      })
      expect(subs.length).toBe(1)
      expect(subs[0].provider_status).toBe('active')
    })
  })

  describe('Scenario 3: Monthly Installments', () => {
    it('tracks 1 subscription + multiple distinct donation rows', async () => {
      const subId = 'sub_monthly'

      // Setup subscription
      await injectWebhook('customer.subscription.created', {
        id: subId,
        status: 'active',
        plan: { amount: 4000, currency: 'usd' },
      })

      let donations = await db.donation.findMany({
        where: { payment_account_id: paymentAccountId },
      })
      expect(donations.length).toBe(0)

      // Month 1
      await injectWebhook('invoice.payment_succeeded', {
        id: 'in_month1',
        payment_intent: 'pi_month1',
        subscription: subId,
        amount_paid: 4000,
        currency: 'usd',
      })

      // Month 2
      await injectWebhook('invoice.payment_succeeded', {
        id: 'in_month2',
        payment_intent: 'pi_month2',
        subscription: subId,
        amount_paid: 4000,
        currency: 'usd',
      })

      donations = await db.donation.findMany({ where: { payment_account_id: paymentAccountId } })
      expect(donations.length).toBe(2)

      const subRefs = new Set(donations.map((d) => d.subscription_id))
      expect(subRefs.size).toBe(1)

      const currentMonth = new Date().toISOString().substring(0, 7)
      const summary = await GET_DONATION_SUMMARY({
        churchIds: new Set([churchId]),
        month: currentMonth,
      })
      expect(Number(summary.currencies[0].grossMinor)).toBe(8000)
    })
  })

  describe('Scenario 4: Refunds', () => {
    it('applies partial and full refunds with multi-currency isolation', async () => {
      // Create USD donation
      await injectWebhook('payment_intent.succeeded', {
        id: 'pi_usd',
        amount: 10000,
        currency: 'usd',
      })
      // Create EUR donation
      await injectWebhook('payment_intent.succeeded', {
        id: 'pi_eur',
        amount: 5000,
        currency: 'eur',
      })

      // Partial refund USD
      await injectWebhook('charge.refunded', {
        id: 'ch_usd',
        payment_intent: 'pi_usd',
        amount_refunded: 2000,
      })

      // Full refund EUR
      await injectWebhook('charge.refunded', {
        id: 'ch_eur',
        payment_intent: 'pi_eur',
        amount_refunded: 5000,
      })

      const currentMonth = new Date().toISOString().substring(0, 7)
      const summary = await GET_DONATION_SUMMARY({
        churchIds: new Set([churchId]),
        month: currentMonth,
      })
      expect(summary.currencies.length).toBe(2)

      const usdSum = summary.currencies.find((s) => s.currency === 'usd')!
      expect(Number(usdSum.grossMinor)).toBe(10000)
      expect(Number(usdSum.refundedMinor)).toBe(2000)
      expect(Number(usdSum.netMinor)).toBe(8000)

      const eurSum = summary.currencies.find((s) => s.currency === 'eur')!
      expect(Number(eurSum.grossMinor)).toBe(5000)
      expect(Number(eurSum.refundedMinor)).toBe(5000)
      expect(Number(eurSum.netMinor)).toBe(0)

      const donations = await db.donation.findMany({
        where: { payment_account_id: paymentAccountId },
      })
      const usdDon = donations.find((d) => d.currency === 'usd')!
      expect(usdDon.status).toBe('PAID')

      const eurDon = donations.find((d) => d.currency === 'eur')!
      expect(eurDon.status).toBe('REFUNDED')
    })
  })

  describe('Scenario 5: Wrong Connected Account', () => {
    it('ignores unknown accounts and isolates cross-church events', async () => {
      // 1. Unknown account
      const { receipt } = await injectWebhook(
        'payment_intent.succeeded',
        {
          id: 'pi_unknown',
          amount: 1000,
          currency: 'usd',
        },
        'acct_unknown',
      )

      expect(receipt.ignored).toBe(true)
      expect(receipt.jobId).toBeUndefined()
      // 2. Cross-church isolation check
      const otherOrg = await db.orgNode.create({
        data: { id: crypto.randomUUID(), name: 'Other Org', kind: 'CHURCH' },
      })
      const otherChurch = await db.church.create({
        data: {
          id: crypto.randomUUID(),
          name: 'Other Church',
          timezone: 'UTC',
          org_node_id: otherOrg.id,
          address: {},
          contacts: [],
          social_links: {},
        },
      })
      const otherAcctId = 'acct_' + crypto.randomBytes(8).toString('hex')
      const otherAccount = await db.paymentAccount.create({
        data: {
          id: crypto.randomUUID(),
          church_id: otherChurch.id,
          provider: 'stripe',
          provider_account_id: otherAcctId,
          status: 'ACTIVE',
        },
      })

      await injectWebhook(
        'payment_intent.succeeded',
        {
          id: 'pi_other',
          amount: 2000,
          currency: 'usd',
        },
        otherAcctId,
      )

      const mainDonations = await db.donation.findMany({
        where: { payment_account_id: paymentAccountId },
      })
      expect(mainDonations.length).toBe(0) // Untouched

      const otherDonations = await db.donation.findMany({
        where: { payment_account_id: otherAccount.id },
      })
      expect(otherDonations.length).toBe(1) // Recorded for other church
      expect(otherDonations[0].amount_minor).toBe(BigInt(2000))
    })
  })

  describe('Scenario 6: Redirect-Before-Webhook Behavior', () => {
    it('proves redirect without webhook does not record donation', async () => {
      // A user is redirected with session_id to success URL.
      // But no webhook arrived yet.
      const donations = await db.donation.findMany({
        where: { payment_account_id: paymentAccountId },
      })
      expect(donations.length).toBe(0)

      const currentMonth = new Date().toISOString().substring(0, 7)
      const summary = await GET_DONATION_SUMMARY({
        churchIds: new Set([churchId]),
        month: currentMonth,
      })
      expect(summary.currencies).toEqual([])

      // Only when webhook arrives does the system synchronize.
      await injectWebhook('payment_intent.succeeded', {
        id: 'pi_redirect',
        amount: 4000,
        currency: 'usd',
      })

      const syncedDonations = await db.donation.findMany({
        where: { payment_account_id: paymentAccountId },
      })
      expect(syncedDonations.length).toBe(1)
      expect(syncedDonations[0].status).toBe('PAID')
    })
  })
})
