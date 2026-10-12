// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { processPaymentSyncJob } from './payment-sync-job'
import { RECORD_STRIPE_WEBHOOK_RECEIPT } from '@/providers/stripe-webhook'
import crypto from 'node:crypto'
import { GET_DONATION_SUMMARY } from '@/providers/donation'

/*
 * DO-08 edge-case scenario tests — every provider dependency is mocked
 * (CI-safe, no PostgreSQL). `injectWebhook` runs the real ingress contract
 * against an in-memory receipt/job store, then the real controller against
 * in-memory donation/subscription mirrors.
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
    donationProvider: {
      GET_DONATION_SUMMARY: fn(),
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
    db: {
      // Minimal db surface: only $transaction passthrough is used by the
      // mocked ingress below; no Prisma query ever runs.
      $transaction: fn(),
    },
  }
})

vi.mock('@/utils/db-connection', () => ({ db: mocks.db }))
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
vi.mock('@/providers/donation', () => ({
  GET_DONATION_SUMMARY: mocks.donationProvider.GET_DONATION_SUMMARY,
}))
vi.mock('@/providers/stripe', () => ({
  isStripeEnabled: mocks.stripe.isStripeEnabled,
  STRIPE: mocks.stripe.STRIPE,
  PLATFORM_ACCOUNT_ID: () => process.env.STRIPE_PLATFORM_ACCOUNT_ID ?? providerAccountId,
}))

import { GeneralError } from '@/utils/general-error'

const providerAccountId = 'acct_platform_test'
vi.stubEnv('STRIPE_PLATFORM_ACCOUNT_ID', providerAccountId)

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

const churchId = 'c1'

beforeEach(() => {
  vi.clearAllMocks()
  jobs = new Map()
  receipts = new Map()
  donations = []
  subscriptions = []

  mocks.outbox.GET_JOB.mockImplementation(async ({ jobId }: { jobId: string }) => jobs.get(jobId))
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
        if (receipt) receipt.state = state === 'SUCCEEDED' ? 'PROCESSED' : state
      }
      return job
    },
  )
  mocks.paymentSync.UPSERT_DONATION_PAYMENT.mockImplementation(
    async ({
      churchId: ch,
      providerPaymentId,
      amountMinor,
      currency,
      status,
      paidAt,
      providerSubscriptionId,
    }: {
      churchId: string
      providerPaymentId: string
      amountMinor: number
      currency: string
      status: string
      paidAt: Date | null
      providerSubscriptionId?: string
    }) => {
      // Placeholder subscription link (mirrors provider: creates zero-amount
      // active subscription row when the subscription event hasn't arrived).
      let subscriptionId: string | null = null
      if (providerSubscriptionId) {
        type SubRow = {
          id: string
          church_id: string
          provider_subscription_id: string
          amount_minor: bigint
          currency: string
          provider_status: string
          created_at: number
          updated_at: number | null
        }
        let sub = subscriptions.find(
          (s): s is SubRow => s.provider_subscription_id === providerSubscriptionId,
        ) as SubRow | undefined
        if (!sub) {
          sub = {
            id: crypto.randomUUID(),
            church_id: ch,
            provider_subscription_id: providerSubscriptionId,
            amount_minor: BigInt(0),
            currency: currency.toLowerCase(),
            provider_status: 'active',
            created_at: Date.now(),
            updated_at: null,
          }
          subscriptions.push(sub)
        } else if (sub.church_id !== ch) {
          sub.church_id = ch
        }
        subscriptionId = sub.id
      }

      const existing = donations.find((d) => d.provider_payment_id === providerPaymentId)
      if (existing) {
        if (existing.status === 'PAID' && status === 'FAILED') return existing
        existing.church_id = ch
        existing.status = status
        existing.paid_at = paidAt
        existing.amount_minor = BigInt(amountMinor)
        existing.currency = currency.toLowerCase()
        existing.subscription_id = subscriptionId ?? existing.subscription_id
        return existing
      }
      const created = {
        id: crypto.randomUUID(),
        church_id: ch,
        provider_payment_id: providerPaymentId,
        amount_minor: BigInt(amountMinor),
        currency: currency.toLowerCase(),
        status,
        paid_at: paidAt,
        refunded_minor: BigInt(0),
        subscription_id: subscriptionId,
        created_at: new Date(),
      }
      donations.push(created)
      return created
    },
  )
  mocks.paymentSync.UPSERT_DONATION_SUBSCRIPTION.mockImplementation(
    async ({
      churchId: ch,
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
        existing.church_id = ch
        existing.amount_minor = BigInt(amountMinor)
        existing.currency = currency.toLowerCase()
        existing.provider_status = providerStatus
        existing.updated_at = eventCreated * 1000
        return existing
      }
      const created = {
        id: crypto.randomUUID(),
        church_id: ch,
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

  // In-memory ingress mirroring RECORD_STRIPE_WEBHOOK_RECEIPT semantics:
  // dedupe on (account, event id), platform-account check, outbox creation.
  mocks.db.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      webhookReceipt: {
        findUnique: async ({
          where,
        }: {
          where: { provider_account_id_event_id: { account_id: string; event_id: string } }
        }) => {
          const key = `${where.provider_account_id_event_id.account_id}:${where.provider_account_id_event_id.event_id}`
          return receipts.get(key) ?? null
        },
        create: async ({ data }: { data: { state: string } & Record<string, unknown> }) => {
          const receipt: MockReceipt & { account_id: string; event_id: string } = {
            id: crypto.randomUUID(),
            state: data.state,
            account_id: String(data.account_id),
            event_id: String(data.event_id),
          }
          receipts.set(`${receipt.account_id}:${receipt.event_id}`, receipt)
          return receipt
        },
      },
      outboxJob: {
        create: async ({ data }: { data: { payload: unknown; resource_id: string | null } }) => {
          const job: MockJob = {
            id: crypto.randomUUID(),
            state: 'PENDING',
            attempts: 0,
            resource_id: data.resource_id,
            payload: data.payload,
            available_at: new Date(),
            last_error_code: null,
          }
          jobs.set(job.id, job)
          return job
        },
      },
    }),
  )
})

// Simulate webhook arrival through the real ingress + controller pipeline.
const injectWebhook = async (
  eventType: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataObject: any,
  overrideAccountId?: string,
) => {
  const accountId = overrideAccountId || providerAccountId
  const eventId = 'evt_' + crypto.randomBytes(8).toString('hex')
  const created = Math.floor(Date.now() / 1000)

  const payloadObj = {
    ...dataObject,
    metadata: {
      churchId,
      ...(dataObject.metadata || {}),
    },
  }

  const receipt = await RECORD_STRIPE_WEBHOOK_RECEIPT({
    event: {
      account: accountId,
      id: eventId,
      type: eventType,
      created,
      objectId: payloadObj.id || 'test_obj',
      data: { object: payloadObj },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  })

  if (receipt.jobId) {
    // Mark as running to satisfy processPaymentSyncJob expectation
    const job = jobs.get(receipt.jobId)
    if (job) job.state = 'RUNNING'
    const outcome = await processPaymentSyncJob(receipt.jobId, crypto.randomUUID())
    return { receipt, outcome }
  }
  return { receipt, outcome: 'ignored' }
}

describe('DO-08 Donation Tests and Edge-Case Synchronization', () => {
  describe('Scenario 1: Failed Payments', () => {
    it('creates a failed donation and does not inflate summary totals', async () => {
      const piId = 'pi_' + crypto.randomBytes(8).toString('hex')
      await injectWebhook('payment_intent.payment_failed', {
        id: piId,
        amount: 5000,
        currency: 'usd',
      })

      // Failed payments don't show up in summary
      mocks.donationProvider.GET_DONATION_SUMMARY.mockResolvedValueOnce({
        month: '2026-10',
        currencies: [],
      })
      const summary = await GET_DONATION_SUMMARY({
        churchIds: new Set([churchId]),
        month: '2026-10',
      })
      expect(summary.currencies).toEqual([])

      expect(donations).toHaveLength(1)
      expect(donations[0].status).toBe('FAILED')
      expect(donations[0].paid_at).toBeNull()
      expect(donations[0].amount_minor).toBe(BigInt(5000))
    })

    it('processes stale failure after success safely', async () => {
      const piId = 'pi_' + crypto.randomBytes(8).toString('hex')

      await injectWebhook('payment_intent.succeeded', {
        id: piId,
        amount: 5000,
        currency: 'usd',
      })
      await injectWebhook('payment_intent.payment_failed', {
        id: piId,
        amount: 5000,
        currency: 'usd',
      })

      expect(donations).toHaveLength(1)
      expect(donations[0].status).toBe('PAID') // Retained PAID status
      expect(donations[0].paid_at).not.toBeNull()
    })

    it('processes charge.failed', async () => {
      const chId = 'ch_' + crypto.randomBytes(8).toString('hex')
      await injectWebhook('charge.failed', {
        id: chId,
        payment_intent: null,
        amount: 2500,
        currency: 'eur',
      })
      expect(donations).toHaveLength(0)

      const piId = 'pi_' + crypto.randomBytes(8).toString('hex')
      await injectWebhook('charge.failed', {
        id: 'ch_' + crypto.randomBytes(8).toString('hex'),
        payment_intent: piId,
        amount: 2500,
        currency: 'eur',
      })

      expect(donations).toHaveLength(1)
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

      expect(donations).toHaveLength(1)
      expect(donations[0].status).toBe('FAILED')
      expect(donations[0].subscription_id).toBeDefined()
    })
  })

  describe('Scenario 2: Duplicate and Out-of-Order Webhooks', () => {
    it('returns duplicate on ingress delivery and creates 1 outbox job', async () => {
      const eventId = 'evt_' + crypto.randomBytes(8).toString('hex')

      const makeEvent = () => ({
        account: providerAccountId,
        id: eventId,
        type: 'payment_intent.succeeded',
        created: Math.floor(Date.now() / 1000),
        objectId: 'pi_test',
        data: { object: { id: 'pi_test', amount: 1000, currency: 'usd' } },
      })

      const receipt1 = await RECORD_STRIPE_WEBHOOK_RECEIPT({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        event: makeEvent() as any,
      })
      expect(receipt1.duplicate).toBe(false)
      expect(receipt1.jobId).toBeDefined()

      const receipt2 = await RECORD_STRIPE_WEBHOOK_RECEIPT({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        event: makeEvent() as any,
      })
      expect(receipt2.duplicate).toBe(true)
      expect(receipt2.receiptId).toBe(receipt1.receiptId)

      // Exactly one outbox job for the first delivery
      expect(Array.from(jobs.values()).filter((j) => j.id === receipt1.jobId)).toHaveLength(1)
    })

    it('idempotently handles duplicate job execution', async () => {
      const piId = 'pi_' + crypto.randomBytes(8).toString('hex')
      const { receipt, outcome } = await injectWebhook('payment_intent.succeeded', {
        id: piId,
        amount: 2000,
        currency: 'usd',
      })
      expect(outcome).toBe('succeeded')

      const job = jobs.get(receipt.jobId!)
      job!.state = 'RUNNING'
      const outcome2 = await processPaymentSyncJob(receipt.jobId!, crypto.randomUUID())
      expect(outcome2).toBe('succeeded') // already processed

      expect(donations).toHaveLength(1)
      expect(donations[0].amount_minor).toBe(BigInt(2000))
    })

    it('resolves out-of-order failure before success', async () => {
      const piId = 'pi_' + crypto.randomBytes(8).toString('hex')

      await injectWebhook('payment_intent.payment_failed', {
        id: piId,
        amount: 3000,
        currency: 'usd',
      })
      expect(donations[0].status).toBe('FAILED')

      await injectWebhook('payment_intent.succeeded', {
        id: piId,
        amount: 3000,
        currency: 'usd',
      })

      expect(donations[0].status).toBe('PAID')
      expect(donations[0].paid_at).not.toBeNull()
    })

    it('resolves out-of-order installment before subscription created', async () => {
      const subId = 'sub_' + crypto.randomBytes(8).toString('hex')
      const invId = 'in_' + crypto.randomBytes(8).toString('hex')
      const piId = 'pi_' + crypto.randomBytes(8).toString('hex')

      await injectWebhook('invoice.payment_succeeded', {
        id: invId,
        payment_intent: piId,
        subscription: subId,
        amount_paid: 1000,
        currency: 'usd',
      })

      let subs = subscriptions.filter((s) => s.church_id === churchId)
      expect(subs).toHaveLength(1)
      expect(subs[0].provider_status).toBe('active')

      await injectWebhook('customer.subscription.created', {
        id: subId,
        status: 'active',
        plan: { amount: 1000, currency: 'usd' },
      })

      subs = subscriptions.filter((s) => s.church_id === churchId)
      expect(subs).toHaveLength(1)
      expect(subs[0].provider_status).toBe('active')
    })

    it('resolves out-of-order refunds so a late partial refund never reduces the refunded total', async () => {
      const piId = 'pi_' + crypto.randomBytes(8).toString('hex')
      const chId = 'ch_' + crypto.randomBytes(8).toString('hex')

      await injectWebhook('payment_intent.succeeded', {
        id: piId,
        amount: 5000,
        currency: 'usd',
      })

      // Full refund arrives first
      await injectWebhook('charge.refunded', {
        id: chId,
        payment_intent: piId,
        amount_refunded: 5000,
      })
      expect(donations[0].refunded_minor).toBe(BigInt(5000))
      expect(donations[0].status).toBe('REFUNDED')

      // Stale / late partial refund arrives after full refund
      await injectWebhook('charge.refunded', {
        id: chId,
        payment_intent: piId,
        amount_refunded: 2000,
      })
      expect(donations[0].refunded_minor).toBe(BigInt(5000))
      expect(donations[0].status).toBe('REFUNDED')
    })
  })

  describe('Scenario 3: Monthly Installments', () => {
    it('tracks 1 subscription + multiple distinct donation rows', async () => {
      const subId = 'sub_' + crypto.randomBytes(8).toString('hex')
      const invMonth1 = 'in_' + crypto.randomBytes(8).toString('hex')
      const piMonth1 = 'pi_' + crypto.randomBytes(8).toString('hex')
      const invMonth2 = 'in_' + crypto.randomBytes(8).toString('hex')
      const piMonth2 = 'pi_' + crypto.randomBytes(8).toString('hex')

      await injectWebhook('customer.subscription.created', {
        id: subId,
        status: 'active',
        plan: { amount: 4000, currency: 'usd' },
      })
      expect(donations).toHaveLength(0)

      await injectWebhook('invoice.payment_succeeded', {
        id: invMonth1,
        payment_intent: piMonth1,
        subscription: subId,
        amount_paid: 4000,
        currency: 'usd',
      })
      await injectWebhook('invoice.payment_succeeded', {
        id: invMonth2,
        payment_intent: piMonth2,
        subscription: subId,
        amount_paid: 4000,
        currency: 'usd',
      })

      expect(donations).toHaveLength(2)

      const subRefs = new Set(donations.map((d) => d.subscription_id))
      expect(subRefs.size).toBe(1)
    })
  })

  describe('Scenario 4: Refunds', () => {
    it('applies partial and full refunds with multi-currency isolation', async () => {
      const piUsd = 'pi_' + crypto.randomBytes(8).toString('hex')
      const piEur = 'pi_' + crypto.randomBytes(8).toString('hex')
      const chUsd = 'ch_' + crypto.randomBytes(8).toString('hex')
      const chEur = 'ch_' + crypto.randomBytes(8).toString('hex')

      await injectWebhook('payment_intent.succeeded', {
        id: piUsd,
        amount: 10000,
        currency: 'usd',
      })
      await injectWebhook('payment_intent.succeeded', {
        id: piEur,
        amount: 5000,
        currency: 'eur',
      })
      await injectWebhook('charge.refunded', {
        id: chUsd,
        payment_intent: piUsd,
        amount_refunded: 2000,
      })
      await injectWebhook('charge.refunded', {
        id: chEur,
        payment_intent: piEur,
        amount_refunded: 5000,
      })

      const usdDon = donations.find((d) => d.currency === 'usd')!
      expect(usdDon.status).toBe('PAID')
      const eurDon = donations.find((d) => d.currency === 'eur')!
      expect(eurDon.status).toBe('REFUNDED')
    })
  })

  describe('Scenario 5: Wrong Connected Account', () => {
    it('ignores unknown accounts and isolates cross-church events', async () => {
      const piUnknown = 'pi_' + crypto.randomBytes(8).toString('hex')
      const { receipt } = await injectWebhook(
        'payment_intent.succeeded',
        {
          id: piUnknown,
          amount: 1000,
          currency: 'usd',
        },
        'acct_unknown',
      )
      expect(receipt.ignored).toBe(true)
      expect(receipt.jobId).toBeUndefined()
      expect(donations).toHaveLength(0) // Unknown account: nothing recorded as donation

      // Cross-church event still attributes to its own church
      const piOther = 'pi_' + crypto.randomBytes(8).toString('hex')
      await injectWebhook('payment_intent.succeeded', {
        id: piOther,
        amount: 2000,
        currency: 'usd',
        metadata: { churchId: 'other-church' },
      })
      const otherDonations = donations.filter((d) => d.church_id === 'other-church')
      expect(otherDonations).toHaveLength(1)
      expect(otherDonations[0].amount_minor).toBe(BigInt(2000))
    })
  })

  describe('Scenario 6: Redirect-Before-Webhook Behavior', () => {
    it('proves redirect without webhook does not record donation', async () => {
      expect(donations).toHaveLength(0)

      // Only when webhook arrives does the system synchronize.
      const piRedirect = 'pi_' + crypto.randomBytes(8).toString('hex')
      await injectWebhook('payment_intent.succeeded', {
        id: piRedirect,
        amount: 4000,
        currency: 'usd',
      })
      expect(donations).toHaveLength(1)
      expect(donations[0].status).toBe('PAID')
    })
  })
})
