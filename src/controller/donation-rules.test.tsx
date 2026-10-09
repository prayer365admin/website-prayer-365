// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/utils/db-connection'
import { processPaymentSyncJob } from './payment-sync-job'
import { GET_DONATION_SUMMARY } from '@/providers/donation'
import crypto from 'node:crypto'

describe('DO-07 Domain Rules', () => {
  let churchId: string

  beforeEach(async () => {
    // No global deleteMany to prevent concurrent test collision
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createJob = async (payload: any) => {
    const receipt = await db.webhookReceipt.create({
      data: {
        id: crypto.randomUUID(),
        provider: 'stripe',
        account_id: `acct_test_${crypto.randomUUID()}`,
        event_id: crypto.randomUUID(),
        event_type: payload.eventType,
        object_id: payload.objectId || 'obj_test',
        received_at: new Date(),
        state: 'PENDING',
      },
    })
    const job = await db.outboxJob.create({
      data: {
        id: crypto.randomUUID(),
        kind: 'payment.sync',
        dedupe_key: crypto.randomUUID(),
        resource_id: receipt.id,
        payload: {
          ...payload,
          dataObject: payload.dataObject
            ? {
                ...payload.dataObject,
                metadata: { churchId, ...(payload.dataObject.metadata || {}) },
              }
            : undefined,
        },
        available_at: new Date(),
        state: 'RUNNING',
      },
    })
    return { receipt, job }
  }

  describe('Rule 1: Subscription event !== paid donation', () => {
    it('does not create Donation rows on subscription created/updated/deleted', async () => {
      const subId = `sub_${crypto.randomUUID()}`

      const { job: job1 } = await createJob({
        eventType: 'customer.subscription.created',
        objectId: subId,
        dataObject: {
          id: subId,
          status: 'active',
          plan: { amount: 1000, currency: 'usd' },
        },
      })
      await processPaymentSyncJob(job1.id, 'req')

      const { job: job2 } = await createJob({
        eventType: 'customer.subscription.updated',
        objectId: subId,
        dataObject: {
          id: subId,
          status: 'past_due',
          plan: { amount: 1500, currency: 'usd' },
        },
      })
      await processPaymentSyncJob(job2.id, 'req')

      const { job: job3 } = await createJob({
        eventType: 'customer.subscription.deleted',
        objectId: subId,
        dataObject: {
          id: subId,
          status: 'canceled',
          plan: { amount: 1500, currency: 'usd' },
        },
      })
      await processPaymentSyncJob(job3.id, 'req')

      const donations = await db.donation.findMany({
        where: { church_id: churchId },
      })
      expect(donations).toHaveLength(0)

      const sub = await db.donationSubscription.findFirst({
        where: { provider_subscription_id: subId },
      })
      expect(sub).toBeDefined()
      expect(sub?.provider_status).toBe('canceled')
    })

    it('creates separate Donation records for each invoice.payment_succeeded installment', async () => {
      const subId = `sub_${crypto.randomUUID()}`
      const inv1 = `inv_${crypto.randomUUID()}`
      const inv2 = `inv_${crypto.randomUUID()}`

      const { job: jobSub } = await createJob({
        eventType: 'customer.subscription.created',
        objectId: subId,
        dataObject: {
          id: subId,
          status: 'active',
          plan: { amount: 1000, currency: 'usd' },
        },
      })
      await processPaymentSyncJob(jobSub.id, 'req')

      const { job: jobInv1 } = await createJob({
        eventType: 'invoice.payment_succeeded',
        objectId: inv1,
        dataObject: {
          id: inv1,
          subscription: subId,
          amount_paid: 1000,
          currency: 'usd',
          payment_intent: `pi_${crypto.randomUUID()}`,
        },
      })
      await processPaymentSyncJob(jobInv1.id, 'req')

      const { job: jobInv2 } = await createJob({
        eventType: 'invoice.payment_succeeded',
        objectId: inv2,
        dataObject: {
          id: inv2,
          subscription: subId,
          amount_paid: 1000,
          currency: 'usd',
          payment_intent: `pi_${crypto.randomUUID()}`,
        },
      })
      await processPaymentSyncJob(jobInv2.id, 'req')

      const donations = await db.donation.findMany({
        where: { church_id: churchId },
        orderBy: { created_at: 'asc' },
      })

      expect(donations).toHaveLength(2)
      expect(donations[0].subscription_id).not.toBeNull()
      expect(donations[1].subscription_id).not.toBeNull()
      expect(donations[0].subscription_id).toBe(donations[1].subscription_id)
      expect(donations[0].amount_minor).toBe(BigInt(1000))
      expect(donations[1].amount_minor).toBe(BigInt(1000))
    })
  })

  describe('Rule 2: Refund notices reported, not a refund UI', () => {
    it('applies refunds incrementally, transitioning to REFUNDED on full refund', async () => {
      const piId = `pi_${crypto.randomUUID()}`

      const { job: jobPi } = await createJob({
        eventType: 'payment_intent.succeeded',
        objectId: piId,
        dataObject: {
          id: piId,
          amount: 5000,
          currency: 'usd',
        },
      })
      await processPaymentSyncJob(jobPi.id, 'req')

      // Partial refund
      const { job: jobRef1 } = await createJob({
        eventType: 'charge.refunded',
        objectId: `ch_${crypto.randomUUID()}`,
        dataObject: {
          id: `ch_${crypto.randomUUID()}`,
          payment_intent: piId,
          amount_refunded: 2000,
          currency: 'usd',
        },
      })
      await processPaymentSyncJob(jobRef1.id, 'req')

      let donation = await db.donation.findFirst({ where: { provider_payment_id: piId } })
      expect(donation?.refunded_minor).toBe(BigInt(2000))
      expect(donation?.status).toBe('PAID')

      // Full refund
      const { job: jobRef2 } = await createJob({
        eventType: 'charge.refunded',
        objectId: `ch_${crypto.randomUUID()}`,
        dataObject: {
          id: `ch_${crypto.randomUUID()}`,
          payment_intent: piId,
          amount_refunded: 5000, // Stripe charge.amount_refunded is cumulative
          currency: 'usd',
        },
      })
      await processPaymentSyncJob(jobRef2.id, 'req')

      donation = await db.donation.findFirst({ where: { provider_payment_id: piId } })
      expect(donation?.refunded_minor).toBe(BigInt(5000))
      expect(donation?.status).toBe('REFUNDED')
    })

    it('aggregates summary without cross-currency sums', async () => {
      // USD donation
      const piUsd = `pi_${crypto.randomUUID()}`
      const { job: jobUsd } = await createJob({
        eventType: 'payment_intent.succeeded',
        objectId: piUsd,
        dataObject: { id: piUsd, amount: 10000, currency: 'usd' },
      })
      await processPaymentSyncJob(jobUsd.id, 'req')

      // EUR donation
      const piEur = `pi_${crypto.randomUUID()}`
      const { job: jobEur } = await createJob({
        eventType: 'payment_intent.succeeded',
        objectId: piEur,
        dataObject: { id: piEur, amount: 5000, currency: 'eur' },
      })
      await processPaymentSyncJob(jobEur.id, 'req')

      // EUR refund
      const { job: jobRefEur } = await createJob({
        eventType: 'charge.refunded',
        objectId: `ch_${crypto.randomUUID()}`,
        dataObject: {
          id: `ch_${crypto.randomUUID()}`,
          payment_intent: piEur,
          amount_refunded: 2000,
          currency: 'eur',
        },
      })
      await processPaymentSyncJob(jobRefEur.id, 'req')

      const month = new Date().toISOString().substring(0, 7)
      const summary = await GET_DONATION_SUMMARY({ churchIds: new Set([churchId]), month })

      expect(summary.currencies).toHaveLength(2)

      const eur = summary.currencies.find((c) => c.currency === 'eur')
      expect(eur).toBeDefined()
      expect(eur?.grossMinor).toBe('5000')
      expect(eur?.refundedMinor).toBe('2000')
      expect(eur?.netMinor).toBe('3000')

      const usd = summary.currencies.find((c) => c.currency === 'usd')
      expect(usd).toBeDefined()
      expect(usd?.grossMinor).toBe('10000')
      expect(usd?.refundedMinor).toBe('0')
      expect(usd?.netMinor).toBe('10000')
    })
  })
})
