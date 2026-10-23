// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { processPaymentSyncJob, runPaymentSyncTick } from './payment-sync-job'
import crypto from 'node:crypto'

/*
 * Controller unit tests — every provider dependency is mocked (CI-safe, no
 * PostgreSQL). Mock state lives in plain Maps keyed by row id, simulating the
 * small slice of outbox/receipt/donation behavior the controller relies on.
 */
const mocks = vi.hoisted(() => {
  const fn = () => vi.fn()
  return {
    outbox: {
      GET_JOB: fn(),
      MARK_JOB_STATE: fn(),
      CLAIM_PENDING_JOBS: fn(),
    },
    paymentSync: {
      GET_PAYMENT_SYNC_CONTEXT: fn(),
      UPSERT_DONATION_SUBSCRIPTION: fn(),
      UPSERT_DONATION_PAYMENT: fn(),
      APPLY_DONATION_REFUND: fn(),
      FINALIZE_PAYMENT_SYNC_JOB: fn(),
    },
    stripe: {
      isStripeEnabled: vi.fn(() => false),
      STRIPE: {
        retrievePaymentIntent: fn(),
        retrieveCharge: fn(),
        retrieveSubscription: fn(),
        retrieveCheckoutSession: fn(),
        retrieveInvoice: fn(),
      },
    },
  }
})

vi.mock('@/providers/outbox-job', () => ({
  GET_JOB: mocks.outbox.GET_JOB,
  MARK_JOB_STATE: mocks.outbox.MARK_JOB_STATE,
  CLAIM_PENDING_JOBS: mocks.outbox.CLAIM_PENDING_JOBS,
}))
vi.mock('@/providers/payment-sync', () => ({
  GET_PAYMENT_SYNC_CONTEXT: mocks.paymentSync.GET_PAYMENT_SYNC_CONTEXT,
  UPSERT_DONATION_SUBSCRIPTION: mocks.paymentSync.UPSERT_DONATION_SUBSCRIPTION,
  UPSERT_DONATION_PAYMENT: mocks.paymentSync.UPSERT_DONATION_PAYMENT,
  APPLY_DONATION_REFUND: mocks.paymentSync.APPLY_DONATION_REFUND,
  FINALIZE_PAYMENT_SYNC_JOB: mocks.paymentSync.FINALIZE_PAYMENT_SYNC_JOB,
}))
vi.mock('@/providers/stripe', () => ({
  isStripeEnabled: mocks.stripe.isStripeEnabled,
  STRIPE: mocks.stripe.STRIPE,
}))

import { GeneralError } from '@/utils/general-error'

type MockJob = {
  id: string
  state: string
  attempts: number
  resource_id: string | null
  payload: unknown
  available_at: Date
  last_error_code: string | null
}
type MockReceipt = { id: string; state: string }

let jobs: Map<string, MockJob>
let receipts: Map<string, MockReceipt>
let donations: Array<Record<string, unknown>>
let subscriptions: Array<Record<string, unknown>>

beforeEach(() => {
  vi.clearAllMocks()
  jobs = new Map()
  receipts = new Map()
  donations = []
  subscriptions = []

  // GET_JOB reads the in-memory job map
  mocks.outbox.GET_JOB.mockImplementation(async ({ jobId }: { jobId: string }) => jobs.get(jobId))

  // MARK_JOB_STATE mutates the in-memory job map like the provider would
  mocks.outbox.MARK_JOB_STATE.mockImplementation(
    async ({
      jobId,
      state,
      errorCode,
      availableAt,
    }: {
      jobId: string
      state: string
      errorCode?: string
      availableAt?: Date
    }) => {
      const job = jobs.get(jobId)
      if (!job) return null
      job.state = state
      if (errorCode) job.last_error_code = errorCode
      if (state === 'PENDING' && availableAt) job.available_at = availableAt
      if (state === 'SUCCEEDED' && !errorCode) job.last_error_code = null
      return job
    },
  )

  mocks.paymentSync.GET_PAYMENT_SYNC_CONTEXT.mockImplementation(
    async ({ receiptId }: { receiptId?: string }) => ({
      receipt: receiptId ? (receipts.get(receiptId) ?? null) : null,
    }),
  )

  // FINALIZE mutates job + receipt like the provider transaction would
  mocks.paymentSync.FINALIZE_PAYMENT_SYNC_JOB.mockImplementation(
    async ({
      jobId,
      receiptId,
      state,
      errorCode,
    }: {
      jobId: string
      receiptId?: string
      state: string
      errorCode?: string
    }) => {
      const job = jobs.get(jobId)!
      job.state = state
      job.last_error_code = errorCode ?? null
      if (receiptId) {
        const receipt = receipts.get(receiptId)
        // Provider maps job SUCCEEDED to receipt PROCESSED (spec §8.5)
        if (receipt) receipt.state = state === 'SUCCEEDED' ? 'PROCESSED' : state
      }
      return job
    },
  )

  // UPSERT_DONATION_PAYMENT mirrors the provider's state machine closely
  // enough for the controller tests: find by provider id, apply transitions.
  mocks.paymentSync.UPSERT_DONATION_PAYMENT.mockImplementation(
    async ({
      churchId,
      providerPaymentId,
      amountMinor,
      currency,
      status,
      paidAt,
    }: {
      churchId: string
      providerPaymentId: string
      amountMinor: number
      currency: string
      status: string
      paidAt: Date | null
      providerSubscriptionId?: string
      userId?: string | null
    }) => {
      const existing = donations.find((d) => d.provider_payment_id === providerPaymentId)
      if (existing) {
        if (existing.status === 'PAID' && status === 'FAILED') return existing
        existing.church_id = churchId
        existing.status = status
        existing.paid_at = paidAt
        existing.amount_minor = BigInt(amountMinor)
        existing.currency = currency.toLowerCase()
        return existing
      }
      const created = {
        id: crypto.randomUUID(),
        church_id: churchId,
        provider_payment_id: providerPaymentId,
        amount_minor: BigInt(amountMinor),
        currency: currency.toLowerCase(),
        status,
        paid_at: paidAt,
        refunded_minor: BigInt(0),
        subscription_id: null as string | null,
      }
      donations.push(created)
      return created
    },
  )

  mocks.paymentSync.UPSERT_DONATION_SUBSCRIPTION.mockImplementation(
    async ({
      churchId,
      providerSubscriptionId,
      amountMinor,
      currency,
      providerStatus,
      eventCreated,
    }: {
      churchId: string
      providerSubscriptionId: string
      amountMinor: number
      currency: string
      providerStatus: string
      eventCreated: number
    }) => {
      const existing = subscriptions.find(
        (s) => s.provider_subscription_id === providerSubscriptionId,
      )
      if (existing) {
        const isCanceled = existing.provider_status === 'canceled'
        const isIncomingNonTerminal = providerStatus !== 'canceled'
        const existingTime = (existing.updated_at ?? existing.created_at) as number
        const isStale = eventCreated * 1000 < existingTime
        if (isCanceled && isIncomingNonTerminal && isStale) return existing
        existing.church_id = churchId
        existing.amount_minor = BigInt(amountMinor)
        existing.currency = currency.toLowerCase()
        existing.provider_status = providerStatus
        existing.updated_at = eventCreated * 1000
        return existing
      }
      const created = {
        id: crypto.randomUUID(),
        church_id: churchId,
        provider_subscription_id: providerSubscriptionId,
        amount_minor: BigInt(amountMinor),
        currency: currency.toLowerCase(),
        provider_status: providerStatus,
        created_at: eventCreated * 1000,
        updated_at: null as number | null,
      }
      subscriptions.push(created)
      return created
    },
  )

  mocks.paymentSync.APPLY_DONATION_REFUND.mockImplementation(
    async ({
      providerPaymentId,
      fallbackPaymentId,
      refundedMinor,
    }: {
      providerPaymentId: string
      fallbackPaymentId?: string
      refundedMinor: number
    }) => {
      let existing = donations.find((d) => d.provider_payment_id === providerPaymentId)
      if (!existing && fallbackPaymentId) {
        existing = donations.find((d) => d.provider_payment_id === fallbackPaymentId)
      }
      if (!existing) {
        throw new GeneralError({
          code: 404,
          error: 'NOT_FOUND',
          error_code: 'DONATION_NOT_FOUND',
          details: `Donation not found for payment ${providerPaymentId}`,
        })
      }
      const next =
        refundedMinor > Number(existing.refunded_minor)
          ? refundedMinor
          : Number(existing.refunded_minor)
      existing.refunded_minor = BigInt(next)
      if (next >= Number(existing.amount_minor)) existing.status = 'REFUNDED'
      return existing
    },
  )
})

const createJob = (
  payload: {
    eventId?: string
    eventType: string
    objectId?: string
    eventCreated?: number
    dataObject?: Record<string, unknown>
  },
  state: 'RUNNING' | 'PENDING' = 'RUNNING',
  availableAt: Date = new Date(Date.now() - 5000),
): { job: MockJob; receipt: MockReceipt } => {
  const receiptId = crypto.randomUUID()
  const receipt: MockReceipt = { id: receiptId, state: 'PENDING' }
  receipts.set(receiptId, receipt)
  const job: MockJob = {
    id: crypto.randomUUID(),
    state,
    attempts: 0,
    resource_id: receiptId,
    payload,
    available_at: availableAt,
    last_error_code: null,
  }
  jobs.set(job.id, job)
  return { job, receipt }
}

const churchId = 'c1'

describe('payment-sync-job controller', () => {
  it('skips non-running or missing jobs', async () => {
    const { job } = createJob({ eventType: 'test' }, 'PENDING')
    const outcome = await processPaymentSyncJob(job.id, 'req1')
    expect(outcome).toBe('skipped')

    const outcomeMissing = await processPaymentSyncJob('no-such-job', 'req1b')
    expect(outcomeMissing).toBe('skipped')
  })

  it('skips jobs without payload after requeue path marks PENDING', async () => {
    const job: MockJob = {
      id: crypto.randomUUID(),
      state: 'RUNNING',
      attempts: 1,
      resource_id: null,
      payload: null,
      available_at: new Date(),
      last_error_code: null,
    }
    jobs.set(job.id, job)
    const outcome = await processPaymentSyncJob(job.id, 'req_missing_payload')
    expect(outcome).toBe('requeued')
    expect(job.state).toBe('PENDING')
    expect(job.last_error_code).toBe('MISSING_PAYLOAD')
  })

  it('idempotently succeeds when WebhookReceipt is already PROCESSED', async () => {
    const { job, receipt } = createJob({ eventType: 'test' })
    receipt.state = 'PROCESSED'

    const outcome = await processPaymentSyncJob(job.id, 'req2')
    expect(outcome).toBe('succeeded')
    expect(job.state).toBe('SUCCEEDED')
  })

  it('successfully processes payment_intent.succeeded and marks job/receipt SUCCEEDED', async () => {
    const piId = `pi_test_${crypto.randomUUID()}`
    const { job, receipt } = createJob({
      eventType: 'payment_intent.succeeded',
      eventCreated: 1750000000,
      dataObject: {
        id: piId,
        amount: 5000,
        currency: 'usd',
        metadata: { churchId },
      },
    })

    const outcome = await processPaymentSyncJob(job.id, 'req3')
    expect(outcome).toBe('succeeded')

    const donation = donations.find((d) => d.provider_payment_id === piId)
    expect(donation?.status).toBe('PAID')
    expect(donation?.amount_minor).toBe(BigInt(5000))
    // paid_at derives from the provider event time, not processing time.
    expect((donation?.paid_at as Date).toISOString()).toBe(
      new Date(1750000000 * 1000).toISOString(),
    )
    expect(donation?.church_id).toBe(churchId)

    expect(job.state).toBe('SUCCEEDED')
    expect(receipt.state).toBe('PROCESSED')
  })

  it('successfully processes payment_intent.payment_failed without overwriting PAID', async () => {
    const piId = `pi_test_fail_${crypto.randomUUID()}`
    const { job: job1 } = createJob({
      eventType: 'payment_intent.succeeded',
      dataObject: { id: piId, amount: 5000, currency: 'usd', metadata: { churchId } },
    })
    const { job: job2 } = createJob({
      eventType: 'payment_intent.payment_failed',
      dataObject: { id: piId, amount: 5000, currency: 'usd', metadata: { churchId } },
    })

    await processPaymentSyncJob(job1.id, 'req_fail_1')
    await processPaymentSyncJob(job2.id, 'req_fail_2')

    const donation = donations.find((d) => d.provider_payment_id === piId)
    expect(donation?.status).toBe('PAID')
  })

  it('successfully processes customer.subscription.created and customer.subscription.deleted', async () => {
    const subId = `sub_test_${crypto.randomUUID()}`
    const { job: job1 } = createJob({
      eventType: 'customer.subscription.created',
      dataObject: {
        id: subId,
        status: 'active',
        plan: { amount: 1000, currency: 'usd' },
        metadata: { churchId },
      },
    })
    const { job: job2 } = createJob({
      eventType: 'customer.subscription.deleted',
      dataObject: {
        id: subId,
        status: 'canceled',
        plan: { amount: 1000, currency: 'usd' },
        metadata: { churchId },
      },
    })

    await processPaymentSyncJob(job1.id, 'req_sub_1')
    let sub = subscriptions.find((s) => s.provider_subscription_id === subId)
    expect(sub?.provider_status).toBe('active')
    expect(donations).toHaveLength(0) // subscription event is not a payment

    await processPaymentSyncJob(job2.id, 'req_sub_2')
    sub = subscriptions.find((s) => s.provider_subscription_id === subId)
    expect(sub?.provider_status).toBe('canceled')
  })

  it('marks subscription canceled when customer.subscription.updated has canceled_at', async () => {
    const subId = `sub_test_${crypto.randomUUID()}`
    const { job: job1 } = createJob({
      eventType: 'customer.subscription.created',
      dataObject: {
        id: subId,
        status: 'active',
        plan: { amount: 2500, currency: 'eur' },
        metadata: { churchId },
      },
    })
    const { job: job2 } = createJob({
      eventType: 'customer.subscription.updated',
      dataObject: {
        id: subId,
        status: 'active',
        canceled_at: 1792737150,
        cancel_at: 1795170189,
        plan: { amount: 2500, currency: 'eur' },
        metadata: { churchId },
      },
    })

    await processPaymentSyncJob(job1.id, 'req_sub_create')
    let sub = subscriptions.find((s) => s.provider_subscription_id === subId)
    expect(sub?.provider_status).toBe('active')

    await processPaymentSyncJob(job2.id, 'req_sub_update_cancel')
    sub = subscriptions.find((s) => s.provider_subscription_id === subId)
    expect(sub?.provider_status).toBe('canceled')
  })

  it('successfully processes charge.refunded', async () => {
    const chId = `ch_test_${crypto.randomUUID()}`
    const piId = `pi_ref_${crypto.randomUUID()}`
    const { job: job1 } = createJob({
      eventType: 'charge.succeeded',
      dataObject: {
        id: chId,
        payment_intent: piId,
        amount: 2000,
        currency: 'usd',
        metadata: { churchId },
      },
    })
    const { job: job2 } = createJob({
      eventType: 'charge.refunded',
      dataObject: {
        id: chId,
        payment_intent: piId,
        amount_refunded: 2000,
        currency: 'usd',
        metadata: { churchId },
      },
    })

    await processPaymentSyncJob(job1.id, 'req_ref_1')
    await processPaymentSyncJob(job2.id, 'req_ref_2')

    const donation = donations.find((d) => d.provider_payment_id === piId)
    expect(donation?.status).toBe('REFUNDED')
    expect(donation?.refunded_minor).toBe(BigInt(2000))
  })

  it('marks job as FAILED when attempts reaches MAX_ATTEMPTS (dead-letter)', async () => {
    const { job, receipt } = createJob({ eventType: 'unknown.event_type' }, 'RUNNING')
    job.attempts = 3

    const outcome = await processPaymentSyncJob(job.id, 'req_dlq')
    expect(outcome).toBe('failed')
    expect(job.state).toBe('FAILED')
    expect(job.last_error_code).toBe('MISSING_EVENT_OBJECT')
    expect(receipt.state).toBe('FAILED')
  })

  it('pins attempts execution lifecycle: requeues on attempts 1 and 2, dead-letters on attempt 3', async () => {
    const { job } = createJob({ eventType: 'unknown.event_type' }, 'RUNNING')

    // Attempt 1: fails and requeues
    job.attempts = 1
    const outcome1 = await processPaymentSyncJob(job.id, 'req_attempt_1')
    expect(outcome1).toBe('requeued')
    expect(job.state).toBe('PENDING')

    // Attempt 2: fails and requeues
    job.attempts = 2
    job.state = 'RUNNING'
    const outcome2 = await processPaymentSyncJob(job.id, 'req_attempt_2')
    expect(outcome2).toBe('requeued')
    expect(job.state).toBe('PENDING')

    // Attempt 3: reaches MAX_ATTEMPTS = 3, marks FAILED
    job.attempts = 3
    job.state = 'RUNNING'
    const outcome3 = await processPaymentSyncJob(job.id, 'req_attempt_3')
    expect(outcome3).toBe('failed')
    expect(job.state).toBe('FAILED')
  })

  it('requeues charge.refunded when donation is not found (refund before payment)', async () => {
    const before = new Date()
    const { job } = createJob({
      eventType: 'charge.refunded',
      dataObject: {
        id: 'ch_r',
        payment_intent: 'pi_missing',
        amount_refunded: 100,
        currency: 'usd',
        metadata: { churchId },
      },
    })

    const outcome = await processPaymentSyncJob(job.id, 'req_ref_missing')
    expect(outcome).toBe('requeued')
    expect(job.state).toBe('PENDING')
    expect(job.last_error_code).toBe('DONATION_NOT_FOUND')
    expect(job.available_at.getTime()).toBeGreaterThan(before.getTime())
  })

  it('marks job and receipt FAILED when refund-before-payment reaches REFUND_MAX_ATTEMPTS', async () => {
    const { job, receipt } = createJob({
      eventType: 'charge.refunded',
      dataObject: {
        id: 'ch_r',
        payment_intent: 'pi_missing',
        amount_refunded: 100,
        currency: 'usd',
        metadata: { churchId },
      },
    })
    job.attempts = 10

    const outcome = await processPaymentSyncJob(job.id, 'req_ref_exhausted')
    expect(outcome).toBe('failed')
    expect(job.state).toBe('FAILED')
    expect(receipt.state).toBe('FAILED')
  })

  it('skips orphan donation row for charge.failed without payment_intent', async () => {
    const { job } = createJob({
      eventType: 'charge.failed',
      dataObject: {
        id: 'ch_x',
        payment_intent: null,
        amount: 1000,
        currency: 'usd',
        metadata: { churchId },
      },
    })

    const outcome = await processPaymentSyncJob(job.id, 'req_ch_failed_orphan')
    expect(outcome).toBe('succeeded')
    expect(donations).toHaveLength(0)
  })

  it('creates donation row with church_id when metadata.churchId is present', async () => {
    const paymentId = `pi_meta_${crypto.randomUUID()}`
    const { job, receipt } = createJob({
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

    const donation = donations.find((d) => d.provider_payment_id === paymentId)
    expect(donation).toBeDefined()
    expect(donation?.church_id).toBe(churchId)
    expect(donation?.amount_minor).toBe(BigInt(7500))
    expect(receipt.state).toBe('PROCESSED')
  })

  it('skips event and creates no donation row when metadata.churchId is missing', async () => {
    const paymentId = `pi_nometa_${crypto.randomUUID()}`
    const { job, receipt } = createJob({
      eventType: 'payment_intent.succeeded',
      dataObject: {
        id: paymentId,
        amount: 5000,
        currency: 'usd',
      },
    })

    const outcome = await processPaymentSyncJob(job.id, 'req_nometa_1')
    expect(outcome).toBe('skipped')
    expect(donations).toHaveLength(0)
    expect(receipt.state).toBe('PROCESSED')
    expect(job.state).toBe('SUCCEEDED')
  })

  it('requeues job with future available_at and MISSING_EVENT_OBJECT when event object is missing and attempts < MAX_ATTEMPTS', async () => {
    const { job } = createJob({ eventType: 'custom.unknown.event' })
    const outcome = await processPaymentSyncJob(job.id, 'req_requeue_unknown')
    expect(outcome).toBe('requeued')
    expect(job.state).toBe('PENDING')
    expect(job.last_error_code).toBe('MISSING_EVENT_OBJECT')
    expect(job.available_at.getTime()).toBeGreaterThan(Date.now())
  })

  it('stores donation under payment_intent id when payment_intent is an object on charge.succeeded', async () => {
    const paymentId = `pi_obj_${crypto.randomUUID()}`
    const chargeId = `ch_obj_${crypto.randomUUID()}`
    const { job } = createJob({
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

    const outcome = await processPaymentSyncJob(job.id, 'req_ch_obj_pi')
    expect(outcome).toBe('succeeded')

    const donation = donations.find((d) => d.provider_payment_id === paymentId)
    expect(donation).toBeDefined()
    expect(donation?.church_id).toBe(churchId)
    expect(donation?.amount_minor).toBe(BigInt(3500))
    expect(donation?.status).toBe('PAID')
  })

  it('re-fetches authoritative state from Stripe when enabled and dataObject is missing', async () => {
    mocks.stripe.isStripeEnabled.mockReturnValue(true)
    const piId = `pi_fetch_${crypto.randomUUID()}`
    mocks.stripe.STRIPE.retrievePaymentIntent.mockResolvedValueOnce({
      id: piId,
      amount: 1500,
      currency: 'usd',
      metadata: { churchId },
    })
    const { job } = createJob({
      eventId: crypto.randomUUID(),
      eventType: 'payment_intent.succeeded',
      objectId: piId,
    })

    const outcome = await processPaymentSyncJob(job.id, 'req_fetch')
    expect(outcome).toBe('succeeded')
    expect(mocks.stripe.STRIPE.retrievePaymentIntent).toHaveBeenCalledWith(piId)
    const donation = donations.find((d) => d.provider_payment_id === piId)
    expect(donation?.amount_minor).toBe(BigInt(1500))
  })

  describe('runPaymentSyncTick', () => {
    it('claims and runs batch of jobs', async () => {
      const { job: job1 } = createJob(
        { eventType: 'test1', dataObject: { id: 'a', metadata: { churchId } } },
        'PENDING',
        new Date(Date.now() - 5000),
      )
      const { job: job2 } = createJob(
        { eventType: 'test2', dataObject: { id: 'b', metadata: { churchId } } },
        'PENDING',
        new Date(Date.now() - 5000),
      )

      // CLAIM flips rows to RUNNING + increments attempts, as the provider does
      mocks.outbox.CLAIM_PENDING_JOBS.mockImplementation(async ({ limit }: { limit?: number }) => {
        const claimable = Array.from(jobs.values())
          .filter((j) => j.state === 'PENDING' && j.available_at <= new Date())
          .slice(0, limit ?? 5)
        for (const j of claimable) {
          j.state = 'RUNNING'
          j.attempts += 1
        }
        return claimable.map((j) => ({
          id: j.id,
          attempts: j.attempts,
          resource_id: j.resource_id,
          payload: j.payload,
        }))
      })

      const summary = await runPaymentSyncTick({ limit: 5 })
      expect(summary.claimed).toBe(2)
      expect(summary.succeeded).toBe(2)
      expect(jobs.get(job1.id)?.state).toBe('SUCCEEDED')
      expect(jobs.get(job2.id)?.state).toBe('SUCCEEDED')
    })

    it('claims and counts requeued jobs when encountering retryable error', async () => {
      createJob({ eventType: 'unknown.tick.event' }, 'PENDING', new Date(Date.now() - 5000))

      mocks.outbox.CLAIM_PENDING_JOBS.mockImplementation(async ({ limit }: { limit?: number }) => {
        const claimable = Array.from(jobs.values())
          .filter((j) => j.state === 'PENDING' && j.available_at <= new Date())
          .slice(0, limit ?? 5)
        for (const j of claimable) {
          j.state = 'RUNNING'
          j.attempts += 1
        }
        return claimable.map((j) => ({
          id: j.id,
          attempts: j.attempts,
          resource_id: j.resource_id,
          payload: j.payload,
        }))
      })

      const summary = await runPaymentSyncTick({ limit: 5 })
      expect(summary.claimed).toBe(1)
      expect(summary.requeued).toBe(1)
    })
  })
})
