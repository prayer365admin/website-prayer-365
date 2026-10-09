// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/utils/db-connection'
import { processPaymentSyncJob, runPaymentSyncTick } from './payment-sync-job'
import crypto from 'node:crypto'
import { RECORD_STRIPE_WEBHOOK_RECEIPT } from '@/providers/stripe-webhook'
import { PLATFORM_ACCOUNT_ID } from '@/providers/stripe'

describe('payment-sync-job controller', () => {
  let churchId: string

  beforeEach(async () => {
    // No global deleteMany to prevent concurrent test collision
    vi.useRealTimers()

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

    await db.donation.deleteMany({
      where: {
        provider_payment_id: { in: ['pi_test', 'pi_test_fail', 'ch_test'] },
      },
    })
    await db.donationSubscription.deleteMany({
      where: {
        provider_subscription_id: { in: ['sub_test'] },
      },
    })
  })

  const createJob = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any,
    state: 'RUNNING' | 'PENDING' = 'RUNNING',
    availableAt: Date = new Date(Date.now() - 5000),
  ) => {
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
        },
        available_at: availableAt,
        state,
      },
    })
    return { receipt, job }
  }

  it('skips non-running or missing jobs', async () => {
    const { job, receipt } = await createJob({ eventType: 'test' }, 'PENDING')
    const outcome = await processPaymentSyncJob(job.id, 'req1')
    expect(outcome).toBe('skipped')

    await db.outboxJob.delete({ where: { id: job.id } })
    await db.webhookReceipt.delete({ where: { id: receipt.id } })
  })

  it('idempotently succeeds when WebhookReceipt is already PROCESSED', async () => {
    const { job, receipt } = await createJob({ eventType: 'test' })
    await db.webhookReceipt.update({ where: { id: receipt.id }, data: { state: 'PROCESSED' } })

    const outcome = await processPaymentSyncJob(job.id, 'req2')
    expect(outcome).toBe('succeeded')
  })

  it('successfully processes payment_intent.succeeded and marks job/receipt SUCCEEDED', async () => {
    const piId = `pi_test_${crypto.randomUUID()}`
    const { job, receipt } = await createJob({
      eventType: 'payment_intent.succeeded',
      eventCreated: 1750000000,
      dataObject: {
        id: piId,
        amount: 5000,
        currency: 'usd',
        metadata: { churchId },
      },
    })
    try {
      const outcome = await processPaymentSyncJob(job.id, 'req3')
      expect(outcome).toBe('succeeded')

      const p = await db.donation.findFirst({
        where: { church_id: churchId, provider_payment_id: piId },
      })
      expect(p?.status).toBe('PAID')
      expect(p?.amount_minor).toBe(BigInt(5000))
      // paid_at derives from the provider event time, not processing time.
      expect(p?.paid_at?.toISOString()).toBe(new Date(1750000000 * 1000).toISOString())

      const j = await db.outboxJob.findUnique({ where: { id: job.id } })
      expect(j?.state).toBe('SUCCEEDED')

      const r = await db.webhookReceipt.findUnique({ where: { id: receipt.id } })
      expect(r?.state).toBe('PROCESSED')
    } finally {
      await db.donation.deleteMany({ where: { provider_payment_id: piId } })
      await db.outboxJob.deleteMany({ where: { id: job.id } })
      await db.webhookReceipt.deleteMany({ where: { id: receipt.id } })
    }
  })

  it('successfully processes payment_intent.payment_failed without overwriting PAID', async () => {
    const piId = `pi_test_fail_${crypto.randomUUID()}`
    // 1. Paid
    const { job: job1, receipt: receipt1 } = await createJob({
      eventType: 'payment_intent.succeeded',
      dataObject: { id: piId, amount: 5000, currency: 'usd', metadata: { churchId } },
    })
    // 2. Failed (stale)
    const { job: job2, receipt: receipt2 } = await createJob({
      eventType: 'payment_intent.payment_failed',
      dataObject: { id: piId, amount: 5000, currency: 'usd', metadata: { churchId } },
    })
    try {
      await processPaymentSyncJob(job1.id, 'req_fail_1')
      await processPaymentSyncJob(job2.id, 'req_fail_2')

      // Must remain PAID
      const p = await db.donation.findFirst({
        where: { church_id: churchId, provider_payment_id: piId },
      })
      expect(p?.status).toBe('PAID')
    } finally {
      await db.donation.deleteMany({ where: { provider_payment_id: piId } })
      await db.outboxJob.deleteMany({ where: { id: { in: [job1.id, job2.id] } } })
      await db.webhookReceipt.deleteMany({ where: { id: { in: [receipt1.id, receipt2.id] } } })
    }
  })

  it('successfully processes customer.subscription.created and customer.subscription.deleted', async () => {
    const subId = `sub_test_${crypto.randomUUID()}`
    const { job: job1, receipt: receipt1 } = await createJob({
      eventType: 'customer.subscription.created',
      dataObject: {
        id: subId,
        status: 'active',
        plan: { amount: 1000, currency: 'usd' },
        metadata: { churchId },
      },
    })
    const { job: job2, receipt: receipt2 } = await createJob({
      eventType: 'customer.subscription.deleted',
      dataObject: {
        id: subId,
        status: 'canceled',
        plan: { amount: 1000, currency: 'usd' },
        metadata: { churchId },
      },
    })
    try {
      await processPaymentSyncJob(job1.id, 'req_sub_1')

      let sub = await db.donationSubscription.findFirst({
        where: { church_id: churchId, provider_subscription_id: subId },
      })
      expect(sub?.provider_status).toBe('active')

      await processPaymentSyncJob(job2.id, 'req_sub_2')

      sub = await db.donationSubscription.findFirst({
        where: { church_id: churchId, provider_subscription_id: subId },
      })
      expect(sub?.provider_status).toBe('canceled')
    } finally {
      await db.donationSubscription.deleteMany({ where: { provider_subscription_id: subId } })
      await db.outboxJob.deleteMany({ where: { id: { in: [job1.id, job2.id] } } })
      await db.webhookReceipt.deleteMany({ where: { id: { in: [receipt1.id, receipt2.id] } } })
    }
  })

  it('successfully processes charge.refunded', async () => {
    const chId = `ch_test_${crypto.randomUUID()}`
    const { job: job1, receipt: receipt1 } = await createJob({
      eventType: 'charge.succeeded',
      dataObject: { id: chId, amount: 2000, currency: 'usd', metadata: { churchId } },
    })
    const { job: job2, receipt: receipt2 } = await createJob({
      eventType: 'charge.refunded',
      dataObject: { id: chId, amount_refunded: 2000, currency: 'usd', metadata: { churchId } },
    })
    try {
      await processPaymentSyncJob(job1.id, 'req_ref_1')
      await processPaymentSyncJob(job2.id, 'req_ref_2')

      const p = await db.donation.findFirst({
        where: { church_id: churchId, provider_payment_id: chId },
      })
      expect(p?.status).toBe('REFUNDED')
      expect(p?.refunded_minor).toBe(BigInt(2000))
    } finally {
      await db.donation.deleteMany({ where: { provider_payment_id: chId } })
      await db.outboxJob.deleteMany({ where: { id: { in: [job1.id, job2.id] } } })
      await db.webhookReceipt.deleteMany({ where: { id: { in: [receipt1.id, receipt2.id] } } })
    }
  })
  it('marks job as FAILED when attempts reaches MAX_ATTEMPTS (dead-letter)', async () => {
    const { job, receipt } = await createJob(
      { eventType: 'unknown.event_type' }, // Will fail to process event
      'RUNNING',
    )
    // Set attempts to 3 (MAX_ATTEMPTS)
    await db.outboxJob.update({
      where: { id: job.id },
      data: { attempts: 3 },
    })

    const outcome = await processPaymentSyncJob(job.id, 'req_dlq')
    expect(outcome).toBe('failed')
    const updatedJob = await db.outboxJob.findUnique({ where: { id: job.id } })
    expect(updatedJob?.state).toBe('FAILED')
    expect(updatedJob?.last_error_code).toBe('MISSING_EVENT_OBJECT')

    const updatedReceipt = await db.webhookReceipt.findUnique({ where: { id: receipt.id } })
    expect(updatedReceipt?.state).toBe('FAILED')
  })

  it('re-arms job and receipt when redelivering an event whose receipt is FAILED', async () => {
    const eventId = `evt_${crypto.randomUUID()}`
    const accountId = PLATFORM_ACCOUNT_ID()

    const receipt = await db.webhookReceipt.create({
      data: {
        id: crypto.randomUUID(),
        provider: 'stripe',
        account_id: accountId,
        event_id: eventId,
        event_type: 'payment_intent.succeeded',
        object_id: 'pi_test_recovery',
        received_at: new Date(),
        state: 'FAILED',
      },
    })
    const job = await db.outboxJob.create({
      data: {
        id: crypto.randomUUID(),
        kind: 'payment.sync',
        dedupe_key: `payment.sync:stripe:${accountId}:${eventId}`,
        resource_id: receipt.id,
        payload: {
          eventType: 'payment_intent.succeeded',
          dataObject: { id: 'pi_test_recovery', metadata: { churchId } },
        },
        available_at: new Date(),
        state: 'FAILED',
        attempts: 3,
        last_error_code: 'SOME_ERROR',
      },
    })

    try {
      const redelivery = await RECORD_STRIPE_WEBHOOK_RECEIPT({
        event: {
          id: eventId,
          type: 'payment_intent.succeeded',
          account: accountId,
          objectId: 'pi_test_recovery',
          data: {
            object: { id: 'pi_test_recovery' },
          },
        },
      })

      expect(redelivery.duplicate).toBe(true)
      expect(redelivery.ignored).toBe(false)
      expect(redelivery.jobId).toBe(job.id)

      const updatedJob = await db.outboxJob.findUnique({ where: { id: job.id } })
      expect(updatedJob?.state).toBe('PENDING')
      expect(updatedJob?.attempts).toBe(0)
      expect(updatedJob?.last_error_code).toBeNull()

      const updatedReceipt = await db.webhookReceipt.findUnique({ where: { id: receipt.id } })
      expect(updatedReceipt?.state).toBe('PENDING')
    } finally {
      await db.outboxJob.deleteMany({ where: { id: job.id } })
      await db.webhookReceipt.deleteMany({ where: { id: receipt.id } })
    }
  })

  it('requeues charge.refunded when donation is not found (refund before payment)', async () => {
    const before = new Date()
    const { job, receipt } = await createJob({
      eventType: 'charge.refunded',
      dataObject: {
        id: 'ch_r',
        payment_intent: 'pi_missing',
        amount_refunded: 100,
        currency: 'usd',
        metadata: { churchId },
      },
    })

    try {
      const outcome = await processPaymentSyncJob(job.id, 'req_ref_missing')
      expect(outcome).toBe('requeued')

      const updatedJob = await db.outboxJob.findUnique({ where: { id: job.id } })
      expect(updatedJob?.state).toBe('PENDING')
      expect(updatedJob?.last_error_code).toBe('DONATION_NOT_FOUND')
      expect(updatedJob?.available_at && updatedJob.available_at > before).toBe(true)
    } finally {
      await db.outboxJob.deleteMany({ where: { id: job.id } })
      await db.webhookReceipt.deleteMany({ where: { id: receipt.id } })
    }
  })

  it('marks job and receipt FAILED when refund-before-payment reaches REFUND_MAX_ATTEMPTS', async () => {
    const { job, receipt } = await createJob({
      eventType: 'charge.refunded',
      dataObject: {
        id: 'ch_r',
        payment_intent: 'pi_missing',
        amount_refunded: 100,
        currency: 'usd',
        metadata: { churchId },
      },
    })
    await db.outboxJob.update({
      where: { id: job.id },
      data: { attempts: 10 },
    })

    try {
      const outcome = await processPaymentSyncJob(job.id, 'req_ref_exhausted')
      expect(outcome).toBe('failed')

      const updatedJob = await db.outboxJob.findUnique({ where: { id: job.id } })
      expect(updatedJob?.state).toBe('FAILED')

      const updatedReceipt = await db.webhookReceipt.findUnique({ where: { id: receipt.id } })
      expect(updatedReceipt?.state).toBe('FAILED')
    } finally {
      await db.outboxJob.deleteMany({ where: { id: job.id } })
      await db.webhookReceipt.deleteMany({ where: { id: receipt.id } })
    }
  })

  it('records receipt without outbox job for checkout.session.completed', async () => {
    const eventId = `evt_${crypto.randomUUID()}`
    const accountId = PLATFORM_ACCOUNT_ID()

    const res = await RECORD_STRIPE_WEBHOOK_RECEIPT({
      event: {
        id: eventId,
        type: 'checkout.session.completed',
        account: accountId,
        objectId: 'cs_test_123',
        data: {
          object: { id: 'cs_test_123' },
        },
      },
    })

    expect(res.ignored).toBe(true)
    expect(res.jobId).toBeUndefined()
    expect(res.receiptId).toBeDefined()

    try {
      const receipt = await db.webhookReceipt.findUnique({ where: { id: res.receiptId } })
      expect(receipt?.state).toBe('PROCESSED')
      expect(receipt?.processed_at).not.toBeNull()

      const jobCount = await db.outboxJob.count({ where: { resource_id: res.receiptId } })
      expect(jobCount).toBe(0)
    } finally {
      if (res.receiptId) {
        await db.webhookReceipt.deleteMany({ where: { id: res.receiptId } })
      }
    }
  })

  it('skips orphan donation row for charge.failed without payment_intent', async () => {
    const { job, receipt } = await createJob({
      eventType: 'charge.failed',
      dataObject: {
        id: 'ch_x',
        payment_intent: null,
        amount: 1000,
        currency: 'usd',
        metadata: { churchId },
      },
    })

    try {
      const outcome = await processPaymentSyncJob(job.id, 'req_ch_failed_orphan')
      expect(outcome).toBe('succeeded')

      const count = await db.donation.count({
        where: { church_id: churchId },
      })
      expect(count).toBe(0)
    } finally {
      await db.outboxJob.deleteMany({ where: { id: job.id } })
      await db.webhookReceipt.deleteMany({ where: { id: receipt.id } })
    }
  })

  describe('runPaymentSyncTick', () => {
    it('claims and runs batch of jobs', async () => {
      await db.outboxJob.deleteMany({
        where: { kind: 'payment.sync', state: 'PENDING' },
      })
      const { job: job1, receipt: r1 } = await createJob(
        { eventType: 'test1', dataObject: { id: 'a', metadata: { churchId } } },
        'PENDING',
        new Date(Date.now() - 5000),
      )
      const { job: job2, receipt: r2 } = await createJob(
        { eventType: 'test2', dataObject: { id: 'b', metadata: { churchId } } },
        'PENDING',
        new Date(Date.now() - 5000),
      )
      try {
        const summary = await runPaymentSyncTick({ limit: 5 })
        expect(summary.claimed).toBeGreaterThanOrEqual(2)
        expect(summary.succeeded).toBeGreaterThanOrEqual(2)
      } finally {
        await db.outboxJob.deleteMany({ where: { id: { in: [job1.id, job2.id] } } })
        await db.webhookReceipt.deleteMany({ where: { id: { in: [r1.id, r2.id] } } })
      }
    })

    it('claims and counts requeued jobs when encountering retryable error', async () => {
      await db.outboxJob.deleteMany({
        where: { kind: 'payment.sync', state: 'PENDING' },
      })
      const { job, receipt } = await createJob(
        { eventType: 'unknown.tick.event' },
        'PENDING',
        new Date(Date.now() - 5000),
      )
      try {
        const summary = await runPaymentSyncTick({ limit: 5 })
        expect(summary.claimed).toBeGreaterThanOrEqual(1)
        expect(summary.requeued).toBeGreaterThanOrEqual(1)
      } finally {
        await db.outboxJob.deleteMany({ where: { id: job.id } })
        await db.webhookReceipt.deleteMany({ where: { id: receipt.id } })
      }
    })
  })
  it('creates donation row with church_id when metadata.churchId is present', async () => {
    const paymentId = `pi_meta_${crypto.randomUUID()}`
    const { job, receipt } = await createJob({
      eventType: 'payment_intent.succeeded',
      eventCreated: 1750000000,
      dataObject: {
        id: paymentId,
        amount: 7500,
        currency: 'usd',
        metadata: { churchId },
      },
    })
    const outcome = await processPaymentSyncJob(job.id, 'req_meta_1')
    expect(outcome).toBe('succeeded')

    const donation = await db.donation.findUnique({
      where: { provider_payment_id: paymentId },
    })
    expect(donation).toBeDefined()
    expect(donation?.church_id).toBe(churchId)
    expect(donation?.amount_minor).toBe(BigInt(7500))

    const r = await db.webhookReceipt.findUnique({ where: { id: receipt.id } })
    expect(r?.state).toBe('PROCESSED')
  })

  it('skips event and creates no donation row when metadata.churchId is missing', async () => {
    const paymentId = `pi_nometa_${crypto.randomUUID()}`
    const { job, receipt } = await createJob({
      eventType: 'payment_intent.succeeded',
      dataObject: {
        id: paymentId,
        amount: 5000,
        currency: 'usd',
      },
    })
    const outcome = await processPaymentSyncJob(job.id, 'req_nometa_1')
    expect(outcome).toBe('skipped')

    const donation = await db.donation.findUnique({
      where: { provider_payment_id: paymentId },
    })
    expect(donation).toBeNull()

    const r = await db.webhookReceipt.findUnique({ where: { id: receipt.id } })
    expect(r?.state).toBe('PROCESSED')

    const j = await db.outboxJob.findUnique({ where: { id: job.id } })
    expect(j?.state).toBe('SUCCEEDED')
  })

  it('requeues job with future available_at and MISSING_EVENT_OBJECT when event object is missing and attempts < MAX_ATTEMPTS', async () => {
    const { job, receipt } = await createJob({
      eventType: 'custom.unknown.event',
    })
    try {
      const outcome = await processPaymentSyncJob(job.id, 'req_requeue_unknown')
      expect(outcome).toBe('requeued')

      const updatedJob = await db.outboxJob.findUnique({ where: { id: job.id } })
      expect(updatedJob?.state).toBe('PENDING')
      expect(updatedJob?.last_error_code).toBe('MISSING_EVENT_OBJECT')
      expect(updatedJob?.available_at.getTime()).toBeGreaterThan(Date.now())
    } finally {
      await db.outboxJob.deleteMany({ where: { id: job.id } })
      await db.webhookReceipt.deleteMany({ where: { id: receipt.id } })
    }
  })

  it('stores donation under payment_intent id when payment_intent is an object on charge.succeeded', async () => {
    const paymentId = `pi_obj_${crypto.randomUUID()}`
    const chargeId = `ch_obj_${crypto.randomUUID()}`
    const { job, receipt } = await createJob({
      eventType: 'charge.succeeded',
      eventCreated: 1750000000,
      dataObject: {
        id: chargeId,
        payment_intent: { id: paymentId },
        amount: 3500,
        currency: 'usd',
        metadata: { churchId },
      },
    })
    try {
      const outcome = await processPaymentSyncJob(job.id, 'req_ch_obj_pi')
      expect(outcome).toBe('succeeded')

      const donation = await db.donation.findUnique({
        where: { provider_payment_id: paymentId },
      })
      expect(donation).toBeDefined()
      expect(donation?.church_id).toBe(churchId)
      expect(donation?.amount_minor).toBe(BigInt(3500))
      expect(donation?.status).toBe('PAID')
    } finally {
      await db.donation.deleteMany({ where: { provider_payment_id: paymentId } })
      await db.outboxJob.deleteMany({ where: { id: job.id } })
      await db.webhookReceipt.deleteMany({ where: { id: receipt.id } })
    }
  })
})
