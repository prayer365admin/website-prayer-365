// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/utils/db-connection'
import { processPaymentSyncJob, runPaymentSyncTick } from './payment-sync-job'
import crypto from 'node:crypto'
import { RECORD_STRIPE_WEBHOOK_RECEIPT } from '@/providers/stripe-webhook'

describe('payment-sync-job controller', () => {
  let churchId: string
  let paymentAccountId: string

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

    const account = await db.paymentAccount.create({
      data: {
        id: crypto.randomUUID(),
        church_id: churchId,
        provider: 'stripe',
        provider_account_id: `acct_test_${crypto.randomUUID()}`,
        status: 'active',
      },
    })
    paymentAccountId = account.id
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
          paymentAccountId,
          churchId,
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
    const { job, receipt } = await createJob({
      eventType: 'payment_intent.succeeded',
      eventCreated: 1750000000,
      dataObject: {
        id: 'pi_test',
        amount: 5000,
        currency: 'usd',
      },
    })
    const outcome = await processPaymentSyncJob(job.id, 'req3')
    expect(outcome).toBe('succeeded')

    const p = await db.donation.findFirst({ where: { payment_account_id: paymentAccountId } })
    expect(p?.status).toBe('PAID')
    expect(p?.amount_minor).toBe(BigInt(5000))
    // paid_at derives from the provider event time, not processing time.
    expect(p?.paid_at?.toISOString()).toBe(new Date(1750000000 * 1000).toISOString())

    const j = await db.outboxJob.findUnique({ where: { id: job.id } })
    expect(j?.state).toBe('SUCCEEDED')

    const r = await db.webhookReceipt.findUnique({ where: { id: receipt.id } })
    expect(r?.state).toBe('PROCESSED')
  })

  it('successfully processes payment_intent.payment_failed without overwriting PAID', async () => {
    // 1. Paid
    const { job: job1 } = await createJob({
      eventType: 'payment_intent.succeeded',
      dataObject: { id: 'pi_test_fail', amount: 5000, currency: 'usd' },
    })
    await processPaymentSyncJob(job1.id, 'req_fail_1')

    // 2. Failed (stale)
    const { job: job2 } = await createJob({
      eventType: 'payment_intent.payment_failed',
      dataObject: { id: 'pi_test_fail', amount: 5000, currency: 'usd' },
    })
    await processPaymentSyncJob(job2.id, 'req_fail_2')

    // Must remain PAID
    const p = await db.donation.findFirst({
      where: { payment_account_id: paymentAccountId, provider_payment_id: 'pi_test_fail' },
    })
    expect(p?.status).toBe('PAID')
  })

  it('successfully processes customer.subscription.created and customer.subscription.deleted', async () => {
    const { job: job1 } = await createJob({
      eventType: 'customer.subscription.created',
      dataObject: { id: 'sub_test', status: 'active', plan: { amount: 1000, currency: 'usd' } },
    })
    await processPaymentSyncJob(job1.id, 'req_sub_1')

    let sub = await db.donationSubscription.findFirst({
      where: { payment_account_id: paymentAccountId, provider_subscription_id: 'sub_test' },
    })
    expect(sub?.provider_status).toBe('active')

    const { job: job2 } = await createJob({
      eventType: 'customer.subscription.deleted',
      dataObject: { id: 'sub_test', status: 'canceled', plan: { amount: 1000, currency: 'usd' } },
    })
    await processPaymentSyncJob(job2.id, 'req_sub_2')

    sub = await db.donationSubscription.findFirst({
      where: { payment_account_id: paymentAccountId, provider_subscription_id: 'sub_test' },
    })
    expect(sub?.provider_status).toBe('canceled')
  })

  it('successfully processes charge.refunded', async () => {
    const { job: job1 } = await createJob({
      eventType: 'charge.succeeded',
      dataObject: { id: 'ch_test', amount: 2000, currency: 'usd' },
    })
    await processPaymentSyncJob(job1.id, 'req_ref_1')

    const { job: job2 } = await createJob({
      eventType: 'charge.refunded',
      dataObject: { id: 'ch_test', amount_refunded: 2000, currency: 'usd' },
    })
    await processPaymentSyncJob(job2.id, 'req_ref_2')

    const p = await db.donation.findFirst({
      where: { payment_account_id: paymentAccountId, provider_payment_id: 'ch_test' },
    })
    expect(p?.status).toBe('REFUNDED')
    expect(p?.refunded_minor).toBe(BigInt(2000))
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
    const account = await db.paymentAccount.findUnique({ where: { id: paymentAccountId } })
    const accountId = account!.provider_account_id

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
          dataObject: { id: 'pi_test_recovery' },
          paymentAccountId,
          churchId,
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
    const account = await db.paymentAccount.findUnique({ where: { id: paymentAccountId } })
    const accountId = account!.provider_account_id

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
      dataObject: { id: 'ch_x', payment_intent: null, amount: 1000, currency: 'usd' },
    })

    try {
      const outcome = await processPaymentSyncJob(job.id, 'req_ch_failed_orphan')
      expect(outcome).toBe('succeeded')

      const count = await db.donation.count({
        where: { payment_account_id: paymentAccountId },
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
        { eventType: 'test1', dataObject: { id: 'a' } },
        'PENDING',
        new Date(Date.now() - 5000),
      )
      const { job: job2, receipt: r2 } = await createJob(
        { eventType: 'test2', dataObject: { id: 'b' } },
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
  })
})
