// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/utils/db-connection'
import {
  UPSERT_DONATION_PAYMENT,
  UPSERT_DONATION_SUBSCRIPTION,
  APPLY_DONATION_REFUND,
} from './payment-sync'
import crypto from 'node:crypto'

describe('payment-sync provider', () => {
  let churchId: string
  let paymentAccountId: string

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

  describe('UPSERT_DONATION_SUBSCRIPTION', () => {
    it('inserts a new DonationSubscription without creating a Donation', async () => {
      const sub = await UPSERT_DONATION_SUBSCRIPTION({
        paymentAccountId,
        providerSubscriptionId: 'sub_123',
        amountMinor: 1000,
        currency: 'usd',
        providerStatus: 'active',
        eventCreated: Math.floor(Date.now() / 1000),
      })

      expect(sub).toBeDefined()
      expect(sub.amount_minor).toBe(BigInt(1000))
      expect(sub.provider_status).toBe('active')

      const donations = await db.donation.findMany({
        where: { payment_account_id: paymentAccountId },
      })
      expect(donations.length).toBe(0)
    })

    it('enforces stale-event guard on canceled subscriptions', async () => {
      // 1. Create a canceled subscription
      await UPSERT_DONATION_SUBSCRIPTION({
        paymentAccountId,
        providerSubscriptionId: 'sub_stale',
        amountMinor: 1000,
        currency: 'usd',
        providerStatus: 'canceled',
        eventCreated: Math.floor(Date.now() / 1000),
      })

      // 2. Incoming older event with active status
      const staleSub = await UPSERT_DONATION_SUBSCRIPTION({
        paymentAccountId,
        providerSubscriptionId: 'sub_stale',
        amountMinor: 2000,
        currency: 'usd',
        providerStatus: 'active',
        eventCreated: Math.floor(Date.now() / 1000) - 100000, // much older
      })

      // Status remains canceled, but amount can be updated if logic allows
      expect(staleSub.provider_status).toBe('canceled')
    })
  })

  describe('UPSERT_DONATION_PAYMENT', () => {
    it('creates new payment and links placeholder subscription if missing', async () => {
      const p = await UPSERT_DONATION_PAYMENT({
        paymentAccountId,
        providerPaymentId: 'pi_123',
        amountMinor: 5000,
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
        providerSubscriptionId: 'sub_placeholder',
      })
      expect(p.status).toBe('PAID')
      expect(p.subscription_id).not.toBeNull()

      const sub = await db.donationSubscription.findUniqueOrThrow({
        where: { id: p.subscription_id! },
      })
      expect(sub.provider_subscription_id).toBe('sub_placeholder')
      expect(sub.amount_minor).toBe(BigInt(0)) // Placeholder logic
    })

    it('idempotently handles duplicate PAID', async () => {
      await UPSERT_DONATION_PAYMENT({
        paymentAccountId,
        providerPaymentId: 'pi_idem',
        amountMinor: 1000,
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
      })
      const p2 = await UPSERT_DONATION_PAYMENT({
        paymentAccountId,
        providerPaymentId: 'pi_idem',
        amountMinor: 1000,
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
      })
      expect(p2.status).toBe('PAID')
    })

    it('does not downgrade PAID to FAILED on stale failure event', async () => {
      await UPSERT_DONATION_PAYMENT({
        paymentAccountId,
        providerPaymentId: 'pi_stale',
        amountMinor: 1000,
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
      })
      const p2 = await UPSERT_DONATION_PAYMENT({
        paymentAccountId,
        providerPaymentId: 'pi_stale',
        amountMinor: 1000,
        currency: 'usd',
        status: 'FAILED',
        paidAt: null,
      })
      expect(p2.status).toBe('PAID') // remains PAID
    })

    it('upgrades FAILED to PAID when succeeded event arrives', async () => {
      await UPSERT_DONATION_PAYMENT({
        paymentAccountId,
        providerPaymentId: 'pi_upgrade',
        amountMinor: 1000,
        currency: 'usd',
        status: 'FAILED',
        paidAt: null,
      })
      const p2 = await UPSERT_DONATION_PAYMENT({
        paymentAccountId,
        providerPaymentId: 'pi_upgrade',
        amountMinor: 1000,
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
      })
      expect(p2.status).toBe('PAID')
    })
  })

  describe('APPLY_DONATION_REFUND', () => {
    it('updates refunded_minor and sets REFUNDED if fully refunded', async () => {
      await UPSERT_DONATION_PAYMENT({
        paymentAccountId,
        providerPaymentId: 'pi_refund',
        amountMinor: 2000,
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
      })

      const p1 = await APPLY_DONATION_REFUND({
        paymentAccountId,
        providerPaymentId: 'pi_refund',
        refundedMinor: 1000,
      })
      expect(p1.refunded_minor).toBe(BigInt(1000))
      expect(p1.status).toBe('PAID') // Partial refund

      const p2 = await APPLY_DONATION_REFUND({
        paymentAccountId,
        providerPaymentId: 'pi_refund',
        refundedMinor: 2000,
      })
      expect(p2.refunded_minor).toBe(BigInt(2000))
      expect(p2.status).toBe('REFUNDED') // Full refund
    })
  })
})
