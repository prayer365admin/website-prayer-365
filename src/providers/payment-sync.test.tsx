// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  GET_PAYMENT_SYNC_CONTEXT,
  UPSERT_DONATION_PAYMENT,
  UPSERT_DONATION_SUBSCRIPTION,
  APPLY_DONATION_REFUND,
  FINALIZE_PAYMENT_SYNC_JOB,
} from './payment-sync'
import crypto from 'node:crypto'

/*
 * Provider unit tests — db is fully mocked (CI-safe, no PostgreSQL).
 * tx is the same object db.$transaction hands back, so provider code paths
 * run against one shared in-memory mock surface.
 */
const tx = vi.hoisted(() => ({
  donation: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  donationSubscription: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  webhookReceipt: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  outboxJob: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
}))

vi.mock('@/utils/db-connection', () => ({
  db: {
    ...tx,
    $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
  },
}))

import { db } from '@/utils/db-connection'

const churchId = 'c1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('payment-sync provider', () => {
  describe('GET_PAYMENT_SYNC_CONTEXT', () => {
    it('returns receipt with platform account context', async () => {
      tx.webhookReceipt.findUnique.mockResolvedValueOnce({ id: 'r_ctx' })
      const ctx = await GET_PAYMENT_SYNC_CONTEXT({ receiptId: 'r_ctx' })
      expect(ctx.receipt?.id).toBe('r_ctx')
      expect(tx.webhookReceipt.findUnique).toHaveBeenCalledWith({ where: { id: 'r_ctx' } })
    })
    it('returns null receipt when receiptId is undefined', async () => {
      const ctx = await GET_PAYMENT_SYNC_CONTEXT({ receiptId: undefined })
      expect(ctx.receipt).toBeNull()
      expect(tx.webhookReceipt.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('UPSERT_DONATION_SUBSCRIPTION', () => {
    it('inserts a new DonationSubscription without creating a Donation', async () => {
      const subId = `sub_${crypto.randomUUID()}`
      tx.donationSubscription.findUnique.mockResolvedValueOnce(null)
      tx.donationSubscription.create.mockResolvedValueOnce({
        id: 's1',
        church_id: churchId,
        provider_subscription_id: subId,
        amount_minor: BigInt(1000),
        currency: 'usd',
        provider_status: 'active',
      })

      const sub = await UPSERT_DONATION_SUBSCRIPTION({
        churchId,
        providerSubscriptionId: subId,
        amountMinor: 1000,
        currency: 'usd',
        providerStatus: 'active',
        eventCreated: Math.floor(Date.now() / 1000),
      })

      expect(sub.provider_status).toBe('active')
      expect(tx.donationSubscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          church_id: churchId,
          provider_subscription_id: subId,
          amount_minor: 1000,
          currency: 'usd',
          provider_status: 'active',
        }),
      })
      expect(tx.donation.create).not.toHaveBeenCalled()
    })

    it('enforces stale-event guard on canceled subscriptions', async () => {
      const subId = `sub_stale_${crypto.randomUUID()}`
      const existing = {
        id: 's_stale',
        church_id: churchId,
        provider_subscription_id: subId,
        amount_minor: BigInt(1000),
        currency: 'usd',
        provider_status: 'canceled',
        created_at: new Date(),
        updated_at: null,
        user_id: null,
      }
      tx.donationSubscription.findUnique.mockResolvedValueOnce(existing)

      // Incoming older event with active status — much older than created_at
      const staleSub = await UPSERT_DONATION_SUBSCRIPTION({
        churchId,
        providerSubscriptionId: subId,
        amountMinor: 2000,
        currency: 'usd',
        providerStatus: 'active',
        eventCreated: Math.floor((existing.created_at.getTime() - 100000) / 1000),
      })

      // Status remains canceled; no mutation by the stale event
      expect(staleSub.provider_status).toBe('canceled')
      expect(staleSub.amount_minor).toBe(BigInt(1000))
      expect(tx.donationSubscription.update).not.toHaveBeenCalled()
    })

    it('allows fresh non-terminal event to reactivate a canceled subscription', async () => {
      const subId = `sub_fresh_${crypto.randomUUID()}`
      const now = Math.floor(Date.now() / 1000)
      tx.donationSubscription.findUnique.mockResolvedValueOnce({
        id: 's_fresh',
        church_id: churchId,
        provider_subscription_id: subId,
        amount_minor: BigInt(1000),
        currency: 'usd',
        provider_status: 'canceled',
        created_at: new Date((now - 1000) * 1000),
        updated_at: null,
        user_id: null,
      })
      tx.donationSubscription.update.mockResolvedValueOnce({
        id: 's_fresh',
        provider_status: 'active',
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
      expect(tx.donationSubscription.update).toHaveBeenCalledWith({
        where: { id: 's_fresh' },
        data: expect.objectContaining({ provider_status: 'active', church_id: churchId }),
      })
    })

    it('cancels older active subscriptions for the same user and church when new active subscription is saved', async () => {
      const subId = `sub_new_${crypto.randomUUID()}`
      tx.donationSubscription.findUnique.mockResolvedValueOnce(null)
      tx.donationSubscription.findMany.mockResolvedValueOnce([
        { id: 's_old_1', provider_subscription_id: 'sub_old_1' },
      ])
      tx.donationSubscription.updateMany.mockResolvedValueOnce({ count: 1 })
      tx.donationSubscription.create.mockResolvedValueOnce({
        id: 's_new',
        church_id: churchId,
        provider_subscription_id: subId,
        amount_minor: BigInt(2500),
        currency: 'eur',
        provider_status: 'active',
        user_id: 'u1',
      })

      const sub = await UPSERT_DONATION_SUBSCRIPTION({
        churchId,
        providerSubscriptionId: subId,
        amountMinor: 2500,
        currency: 'eur',
        providerStatus: 'active',
        eventCreated: Math.floor(Date.now() / 1000),
        userId: 'u1',
      })

      expect(sub.provider_status).toBe('active')
      expect(tx.donationSubscription.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['s_old_1'] } },
        data: { provider_status: 'canceled' },
      })
    })
  })

  describe('UPSERT_DONATION_PAYMENT', () => {
    it('creates new payment and links placeholder subscription if missing', async () => {
      const piId = `pi_${crypto.randomUUID()}`
      const subId = `sub_placeholder_${crypto.randomUUID()}`
      tx.donationSubscription.findUnique.mockResolvedValueOnce(null)
      tx.donationSubscription.create.mockResolvedValueOnce({
        id: 'sub_row_1',
        provider_subscription_id: subId,
        amount_minor: BigInt(0),
        provider_status: 'active',
      })
      tx.donation.findUnique.mockResolvedValueOnce(null)
      tx.donation.create.mockResolvedValueOnce({
        id: 'd1',
        status: 'PAID',
        subscription_id: 'sub_row_1',
      })

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
      expect(p.subscription_id).toBe('sub_row_1')
      // Placeholder subscription: zero amount, active until a subscription event arrives
      expect(tx.donationSubscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ amount_minor: 0, provider_status: 'active' }),
      })
      expect(tx.donation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          church_id: churchId,
          provider_payment_id: piId,
          amount_minor: 5000,
          subscription_id: 'sub_row_1',
        }),
      })
    })

    it('idempotently handles duplicate PAID (no update)', async () => {
      const piId = `pi_idem_${crypto.randomUUID()}`
      const existing = {
        id: 'd_idem',
        church_id: churchId,
        provider_payment_id: piId,
        status: 'PAID',
      }
      tx.donation.findUnique.mockResolvedValueOnce(existing)

      const p2 = await UPSERT_DONATION_PAYMENT({
        churchId,
        providerPaymentId: piId,
        amountMinor: 1000,
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
      })

      expect(p2).toBe(existing)
      expect(tx.donation.update).not.toHaveBeenCalled()
    })

    it('does not downgrade PAID to FAILED on stale failure event', async () => {
      const piId = `pi_stale_${crypto.randomUUID()}`
      tx.donation.findUnique.mockResolvedValueOnce({
        id: 'd_stale',
        church_id: churchId,
        provider_payment_id: piId,
        status: 'PAID',
      })

      const p2 = await UPSERT_DONATION_PAYMENT({
        churchId,
        providerPaymentId: piId,
        amountMinor: 1000,
        currency: 'usd',
        status: 'FAILED',
        paidAt: null,
      })

      expect(p2.status).toBe('PAID')
      expect(tx.donation.update).not.toHaveBeenCalled()
    })

    it('upgrades FAILED to PAID when succeeded event arrives', async () => {
      const piId = `pi_upgrade_${crypto.randomUUID()}`
      tx.donation.findUnique.mockResolvedValueOnce({
        id: 'd_up',
        church_id: churchId,
        provider_payment_id: piId,
        status: 'FAILED',
      })
      tx.donation.update.mockResolvedValueOnce({ id: 'd_up', status: 'PAID' })

      const p2 = await UPSERT_DONATION_PAYMENT({
        churchId,
        providerPaymentId: piId,
        amountMinor: 1000,
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
      })

      expect(p2.status).toBe('PAID')
      expect(tx.donation.update).toHaveBeenCalledWith({
        where: { id: 'd_up' },
        data: expect.objectContaining({ status: 'PAID', church_id: churchId }),
      })
    })

    it('normalizes currency to lowercase upon insertion', async () => {
      const piId = `pi_currency_case_${crypto.randomUUID()}`
      tx.donation.findUnique.mockResolvedValueOnce(null)
      tx.donation.create.mockResolvedValueOnce({ id: 'd_cur', currency: 'usd' })

      await UPSERT_DONATION_PAYMENT({
        churchId,
        providerPaymentId: piId,
        amountMinor: 2500,
        currency: 'USD',
        status: 'PAID',
        paidAt: new Date(),
      })

      expect(tx.donation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ currency: 'usd' }),
      })
    })

    it('reconciles church_id when payment drifts to another church on update', async () => {
      const piId = `pi_drift_${crypto.randomUUID()}`
      tx.donation.findUnique.mockResolvedValueOnce({
        id: 'd_drift',
        church_id: churchId,
        provider_payment_id: piId,
        status: 'PAID',
        refunded_minor: BigInt(0),
        amount_minor: BigInt(3000),
      })
      tx.donation.update.mockResolvedValueOnce({ id: 'd_drift', church_id: 'c2' })

      const updated = await UPSERT_DONATION_PAYMENT({
        churchId: 'c2',
        providerPaymentId: piId,
        amountMinor: 3000,
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
      })

      expect(updated.church_id).toBe('c2')
      expect(tx.donation.update).toHaveBeenCalledWith({
        where: { id: 'd_drift' },
        data: { church_id: 'c2' },
      })
    })
  })

  describe('APPLY_DONATION_REFUND', () => {
    it('updates refunded_minor and keeps PAID on partial refund', async () => {
      const piId = `pi_refund_${crypto.randomUUID()}`
      tx.donation.findUnique.mockResolvedValueOnce({
        id: 'd_ref',
        provider_payment_id: piId,
        amount_minor: BigInt(2000),
        refunded_minor: BigInt(0),
        status: 'PAID',
      })
      tx.donation.update.mockResolvedValueOnce({
        id: 'd_ref',
        refunded_minor: BigInt(1000),
        status: 'PAID',
      })

      const p1 = await APPLY_DONATION_REFUND({ providerPaymentId: piId, refundedMinor: 1000 })

      expect(p1.refunded_minor).toBe(BigInt(1000))
      expect(p1.status).toBe('PAID')
      expect(tx.donation.update).toHaveBeenCalledWith({
        where: { id: 'd_ref' },
        data: { refunded_minor: BigInt(1000), status: 'PAID' },
      })
    })

    it('sets REFUNDED when cumulative refund reaches the full amount', async () => {
      const piId = `pi_refund_full_${crypto.randomUUID()}`
      tx.donation.findUnique.mockResolvedValueOnce({
        id: 'd_ref_full',
        provider_payment_id: piId,
        amount_minor: BigInt(2000),
        refunded_minor: BigInt(1000),
        status: 'PAID',
      })
      tx.donation.update.mockResolvedValueOnce({
        id: 'd_ref_full',
        refunded_minor: BigInt(2000),
        status: 'REFUNDED',
      })

      const p2 = await APPLY_DONATION_REFUND({ providerPaymentId: piId, refundedMinor: 2000 })

      expect(p2.refunded_minor).toBe(BigInt(2000))
      expect(p2.status).toBe('REFUNDED')
    })

    it('does not decrease refunded_minor when a stale lower-cumulative refund arrives after a full refund', async () => {
      const piId = `pi_refund_monotonic_${crypto.randomUUID()}`
      tx.donation.findUnique.mockResolvedValueOnce({
        id: 'd_mono',
        provider_payment_id: piId,
        amount_minor: BigInt(5000),
        refunded_minor: BigInt(5000),
        status: 'REFUNDED',
      })
      tx.donation.update.mockResolvedValueOnce({
        id: 'd_mono',
        refunded_minor: BigInt(5000),
        status: 'REFUNDED',
      })

      const stale = await APPLY_DONATION_REFUND({ providerPaymentId: piId, refundedMinor: 2000 })

      expect(stale.refunded_minor).toBe(BigInt(5000))
      expect(stale.status).toBe('REFUNDED')
      expect(tx.donation.update).toHaveBeenCalledWith({
        where: { id: 'd_mono' },
        data: { refunded_minor: BigInt(5000), status: 'REFUNDED' },
      })
    })

    it('rejects with DONATION_NOT_FOUND 404 when payment does not exist', async () => {
      tx.donation.findUnique.mockResolvedValue(null)

      await expect(
        APPLY_DONATION_REFUND({ providerPaymentId: 'pi_missing', refundedMinor: 500 }),
      ).rejects.toMatchObject({
        code: 404,
        error_code: 'DONATION_NOT_FOUND',
      })
    })
  })

  describe('FINALIZE_PAYMENT_SYNC_JOB', () => {
    it('sets receipt FAILED without processed_at on job failure', async () => {
      tx.outboxJob.update.mockResolvedValueOnce({ id: 'j1', state: 'FAILED' })
      tx.webhookReceipt.update.mockResolvedValueOnce({ id: 'r1', state: 'FAILED' })

      await FINALIZE_PAYMENT_SYNC_JOB({
        jobId: 'j1',
        receiptId: 'r1',
        state: 'FAILED',
        errorCode: 'X',
      })

      expect(tx.outboxJob.update).toHaveBeenCalledWith({
        where: { id: 'j1' },
        data: { state: 'FAILED', last_error_code: 'X' },
      })
      expect(tx.webhookReceipt.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { state: 'FAILED' },
      })
    })

    it('sets receipt PROCESSED with processed_at on success', async () => {
      tx.outboxJob.update.mockResolvedValueOnce({ id: 'j1', state: 'SUCCEEDED' })
      tx.webhookReceipt.update.mockResolvedValueOnce({ id: 'r1', state: 'PROCESSED' })

      await FINALIZE_PAYMENT_SYNC_JOB({ jobId: 'j1', receiptId: 'r1', state: 'SUCCEEDED' })

      expect(tx.outboxJob.update).toHaveBeenCalledWith({
        where: { id: 'j1' },
        data: { state: 'SUCCEEDED', last_error_code: undefined },
      })
      expect(tx.webhookReceipt.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { state: 'PROCESSED', processed_at: expect.any(Date) },
      })
    })

    it('updates job state only when receiptId is not provided', async () => {
      tx.outboxJob.update.mockResolvedValueOnce({ id: 'j2', state: 'SUCCEEDED' })

      await FINALIZE_PAYMENT_SYNC_JOB({ jobId: 'j2', state: 'SUCCEEDED' })

      expect(tx.outboxJob.update).toHaveBeenCalledTimes(1)
      expect(tx.webhookReceipt.update).not.toHaveBeenCalled()
    })
  })

  // Silence unused import lint if db becomes unnecessary later
  void db
})
