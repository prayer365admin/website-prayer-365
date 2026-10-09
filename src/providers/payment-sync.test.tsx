// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/utils/db-connection'
import {
  GET_PAYMENT_SYNC_CONTEXT,
  UPSERT_DONATION_PAYMENT,
  UPSERT_DONATION_SUBSCRIPTION,
  APPLY_DONATION_REFUND,
  FINALIZE_PAYMENT_SYNC_JOB,
} from './payment-sync'
import crypto from 'node:crypto'

describe('payment-sync provider', () => {
  let churchId: string
  beforeEach(async () => {
    const org = await db.orgNode.create({
      data: {
        id: crypto.randomUUID(),
        kind: 'CHURCH',
        name: 'Test Org Node',
      },
    })

    const church = await db.church.create({
      data: {
        id: crypto.randomUUID(),
        org_node_id: org.id,
        name: 'Test Church',
        status: 'APPROVED',
        timezone: 'UTC',
        address: {},
        contacts: [],
        social_links: {},
      },
    })
    churchId = church.id
  })

  describe('GET_PAYMENT_SYNC_CONTEXT', () => {
    it('returns receipt without payment account', async () => {
      const receipt = await db.webhookReceipt.create({
        data: {
          id: crypto.randomUUID(),
          provider: 'stripe',
          account_id: 'acct_test_ctx',
          event_id: `evt_${crypto.randomUUID()}`,
          event_type: 'payment_intent.succeeded',
          object_id: 'pi_test_ctx',
          received_at: new Date(),
          state: 'PENDING',
        },
      })
      const ctx = await GET_PAYMENT_SYNC_CONTEXT({ receiptId: receipt.id })
      expect(ctx.receipt?.id).toBe(receipt.id)
    })
    it('returns null receipt when receiptId is undefined', async () => {
      const ctx = await GET_PAYMENT_SYNC_CONTEXT({ receiptId: undefined })
      expect(ctx.receipt).toBeNull()
    })
  })

  describe('UPSERT_DONATION_SUBSCRIPTION', () => {
    it('inserts a new DonationSubscription without creating a Donation', async () => {
      const subId = `sub_${crypto.randomUUID()}`
      const sub = await UPSERT_DONATION_SUBSCRIPTION({
        churchId,
        providerSubscriptionId: subId,
        amountMinor: 1000,
        currency: 'usd',
        providerStatus: 'active',
        eventCreated: Math.floor(Date.now() / 1000),
      })

      expect(sub).toBeDefined()
      expect(sub.amount_minor).toBe(BigInt(1000))
      expect(sub.provider_status).toBe('active')

      const donations = await db.donation.findMany({
        where: { church_id: churchId },
      })
      expect(donations.length).toBe(0)
    })

    it('enforces stale-event guard on canceled subscriptions', async () => {
      const subId = `sub_stale_${crypto.randomUUID()}`
      // 1. Create a canceled subscription
      await UPSERT_DONATION_SUBSCRIPTION({
        churchId,
        providerSubscriptionId: subId,
        amountMinor: 1000,
        currency: 'usd',
        providerStatus: 'canceled',
        eventCreated: Math.floor(Date.now() / 1000),
      })

      // 2. Incoming older event with active status
      const staleSub = await UPSERT_DONATION_SUBSCRIPTION({
        churchId,
        providerSubscriptionId: subId,
        amountMinor: 2000,
        currency: 'usd',
        providerStatus: 'active',
        eventCreated: Math.floor(Date.now() / 1000) - 100000, // much older
      })

      // Status remains canceled and amounts are not mutated by stale event
      expect(staleSub.provider_status).toBe('canceled')
      const dbSub = await db.donationSubscription.findUnique({
        where: {
          provider_subscription_id: subId,
        },
      })
      expect(dbSub?.provider_status).toBe('canceled')
      expect(dbSub?.amount_minor).toBe(BigInt(1000))
      expect(dbSub?.currency).toBe('usd')
    })

    it('allows fresh non-terminal event to reactivate a canceled subscription', async () => {
      const subId = `sub_fresh_${crypto.randomUUID()}`
      const now = Math.floor(Date.now() / 1000)
      await UPSERT_DONATION_SUBSCRIPTION({
        churchId,
        providerSubscriptionId: subId,
        amountMinor: 1000,
        currency: 'usd',
        providerStatus: 'canceled',
        eventCreated: now,
      })

      const updated = await UPSERT_DONATION_SUBSCRIPTION({
        churchId,
        providerSubscriptionId: subId,
        amountMinor: 1000,
        currency: 'usd',
        providerStatus: 'active',
        eventCreated: now + 100,
      })

      expect(updated.provider_status).toBe('active')
      const dbSub = await db.donationSubscription.findUnique({
        where: { provider_subscription_id: subId },
      })
      expect(dbSub?.provider_status).toBe('active')
    })
  })

  describe('UPSERT_DONATION_PAYMENT', () => {
    it('creates new payment and links placeholder subscription if missing', async () => {
      const piId = `pi_${crypto.randomUUID()}`
      const subId = `sub_placeholder_${crypto.randomUUID()}`
      const p = await UPSERT_DONATION_PAYMENT({
        churchId,
        providerPaymentId: piId,
        amountMinor: 5000,
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
        providerSubscriptionId: subId,
      })
      expect(p.status).toBe('PAID')
      expect(p.subscription_id).not.toBeNull()

      const sub = await db.donationSubscription.findUniqueOrThrow({
        where: { id: p.subscription_id! },
      })
      expect(sub.provider_subscription_id).toBe(subId)
      expect(sub.amount_minor).toBe(BigInt(0)) // Placeholder logic
    })

    it('idempotently handles duplicate PAID', async () => {
      const piId = `pi_idem_${crypto.randomUUID()}`
      await UPSERT_DONATION_PAYMENT({
        churchId,
        providerPaymentId: piId,
        amountMinor: 1000,
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
      })
      const p2 = await UPSERT_DONATION_PAYMENT({
        churchId,
        providerPaymentId: piId,
        amountMinor: 1000,
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
      })
      expect(p2.status).toBe('PAID')
    })

    it('does not downgrade PAID to FAILED on stale failure event', async () => {
      const piId = `pi_stale_${crypto.randomUUID()}`
      await UPSERT_DONATION_PAYMENT({
        churchId,
        providerPaymentId: piId,
        amountMinor: 1000,
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
      })
      const p2 = await UPSERT_DONATION_PAYMENT({
        churchId,
        providerPaymentId: piId,
        amountMinor: 1000,
        currency: 'usd',
        status: 'FAILED',
        paidAt: null,
      })
      expect(p2.status).toBe('PAID') // remains PAID
    })

    it('upgrades FAILED to PAID when succeeded event arrives', async () => {
      const piId = `pi_upgrade_${crypto.randomUUID()}`
      await UPSERT_DONATION_PAYMENT({
        churchId,
        providerPaymentId: piId,
        amountMinor: 1000,
        currency: 'usd',
        status: 'FAILED',
        paidAt: null,
      })
      const p2 = await UPSERT_DONATION_PAYMENT({
        churchId,
        providerPaymentId: piId,
        amountMinor: 1000,
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
      })
      expect(p2.status).toBe('PAID')
    })

    it('normalizes currency to lowercase upon insertion', async () => {
      const piId = `pi_currency_case_${crypto.randomUUID()}`
      const p = await UPSERT_DONATION_PAYMENT({
        churchId,
        providerPaymentId: piId,
        amountMinor: 2500,
        currency: 'USD',
        status: 'PAID',
        paidAt: new Date(),
      })
      expect(p.currency).toBe('usd')
      const record = await db.donation.findUnique({
        where: { provider_payment_id: piId },
      })
      expect(record?.currency).toBe('usd')
    })
  })

  describe('APPLY_DONATION_REFUND', () => {
    it('updates refunded_minor and sets REFUNDED if fully refunded', async () => {
      const piId = `pi_refund_${crypto.randomUUID()}`
      await UPSERT_DONATION_PAYMENT({
        churchId,
        providerPaymentId: piId,
        amountMinor: 2000,
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
      })

      const p1 = await APPLY_DONATION_REFUND({
        providerPaymentId: piId,
        refundedMinor: 1000,
      })
      expect(p1.refunded_minor).toBe(BigInt(1000))
      expect(p1.status).toBe('PAID') // Partial refund

      const p2 = await APPLY_DONATION_REFUND({
        providerPaymentId: piId,
        refundedMinor: 2000,
      })
      expect(p2.refunded_minor).toBe(BigInt(2000))
      expect(p2.status).toBe('REFUNDED') // Full refund
    })

    it('rejects with DONATION_NOT_FOUND 404 when payment does not exist', async () => {
      const piId = `pi_nonexistent_${crypto.randomUUID()}`
      await expect(
        APPLY_DONATION_REFUND({
          providerPaymentId: piId,
          refundedMinor: 500,
        }),
      ).rejects.toMatchObject({
        code: 404,
        error_code: 'DONATION_NOT_FOUND',
      })
    })

    it('does not decrease refunded_minor when a stale lower-cumulative refund arrives after a full refund', async () => {
      const piId = `pi_refund_${crypto.randomUUID()}`
      await UPSERT_DONATION_PAYMENT({
        churchId,
        providerPaymentId: piId,
        amountMinor: 5000,
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
      })

      const fullRefund = await APPLY_DONATION_REFUND({
        providerPaymentId: piId,
        refundedMinor: 5000,
      })
      expect(fullRefund.refunded_minor).toBe(BigInt(5000))
      expect(fullRefund.status).toBe('REFUNDED')

      const staleRefund = await APPLY_DONATION_REFUND({
        providerPaymentId: piId,
        refundedMinor: 2000,
      })
      expect(staleRefund.refunded_minor).toBe(BigInt(5000))
      expect(staleRefund.status).toBe('REFUNDED')

      const record = await db.donation.findUnique({
        where: { provider_payment_id: piId },
      })
      expect(record?.refunded_minor).toBe(BigInt(5000))
      expect(record?.status).toBe('REFUNDED')
    })
  })

  describe('FINALIZE_PAYMENT_SYNC_JOB', () => {
    it('sets receipt state to FAILED without processed_at on job failure, and PROCESSED with processed_at on success', async () => {
      const receipt = await db.webhookReceipt.create({
        data: {
          id: crypto.randomUUID(),
          provider: 'stripe',
          account_id: 'acct_test_fin',
          event_id: `evt_${crypto.randomUUID()}`,
          event_type: 'payment_intent.succeeded',
          object_id: 'pi_test_fin',
          received_at: new Date(),
          state: 'PENDING',
        },
      })
      const job = await db.outboxJob.create({
        data: {
          id: crypto.randomUUID(),
          kind: 'payment.sync',
          dedupe_key: `dedupe_${crypto.randomUUID()}`,
          resource_id: receipt.id,
          payload: { foo: 'bar' },
          available_at: new Date(),
          state: 'RUNNING',
        },
      })

      try {
        await FINALIZE_PAYMENT_SYNC_JOB({
          jobId: job.id,
          receiptId: receipt.id,
          state: 'FAILED',
          errorCode: 'X',
        })
        const failedReceipt = await db.webhookReceipt.findUnique({ where: { id: receipt.id } })
        expect(failedReceipt?.state).toBe('FAILED')
        expect(failedReceipt?.processed_at).toBeNull()

        await FINALIZE_PAYMENT_SYNC_JOB({
          jobId: job.id,
          receiptId: receipt.id,
          state: 'SUCCEEDED',
        })
        const succeededReceipt = await db.webhookReceipt.findUnique({ where: { id: receipt.id } })
        expect(succeededReceipt?.state).toBe('PROCESSED')
        expect(succeededReceipt?.processed_at).not.toBeNull()
      } finally {
        await db.outboxJob.deleteMany({ where: { id: job.id } })
        await db.webhookReceipt.deleteMany({ where: { id: receipt.id } })
      }
    })

    it('updates job state only when receiptId is not provided', async () => {
      const job = await db.outboxJob.create({
        data: {
          id: crypto.randomUUID(),
          kind: 'payment.sync',
          dedupe_key: `dedupe_${crypto.randomUUID()}`,
          payload: { test: 'no_receipt' },
          available_at: new Date(),
          state: 'RUNNING',
        },
      })
      try {
        await FINALIZE_PAYMENT_SYNC_JOB({
          jobId: job.id,
          state: 'SUCCEEDED',
        })
        const updatedJob = await db.outboxJob.findUnique({ where: { id: job.id } })
        expect(updatedJob?.state).toBe('SUCCEEDED')
        expect(updatedJob?.last_error_code).toBeNull()
      } finally {
        await db.outboxJob.deleteMany({ where: { id: job.id } })
      }
    })
  })
})
