// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { planDonationDedupe, type DonateDedupeRow } from './stripe-donation-dedupe-rules'

const row = (
  providerPaymentId: string,
  overrides: Partial<DonateDedupeRow> = {},
): DonateDedupeRow => ({
  id: `id_${providerPaymentId}`,
  providerPaymentId,
  churchId: 'c1',
  amountMinor: BigInt(400),
  refundedMinor: BigInt(0),
  currency: 'eur',
  status: 'PAID',
  paidAt: new Date('2026-11-12T20:40:00Z'),
  createdAt: new Date('2026-11-12T20:40:00Z'),
  ...overrides,
})

describe('planDonationDedupe — one surviving row per Stripe payment', () => {
  it('merges a cs_ row and an in_ row that resolve to the same payment intent', () => {
    const session = row('cs_test_a', { createdAt: new Date('2026-11-12T20:40:02Z') })
    const invoice = row('in_1a', { createdAt: new Date('2026-11-12T20:40:00Z') })

    const plan = planDonationDedupe([session, invoice], () => ({ canonicalId: 'pi_1a' }))

    expect(plan.unresolved).toEqual([])
    expect(plan.groups).toHaveLength(1)
    expect(plan.groups[0]).toMatchObject({
      canonicalId: 'pi_1a',
      keeperId: invoice.id,
      deleteIds: [session.id],
    })
  })

  it('prefers the row already keyed by the canonical id over creation order', () => {
    const pi = row('pi_1a', { createdAt: new Date('2026-11-12T20:40:05Z') })
    const invoice = row('in_1a', { createdAt: new Date('2026-11-12T20:40:00Z') })

    const plan = planDonationDedupe([invoice, pi], () => ({ canonicalId: 'pi_1a' }))

    expect(plan.groups[0].keeperId).toBe(pi.id)
    expect(plan.groups[0].deleteIds).toEqual([invoice.id])
  })

  it('keeps the highest refunded amount and the earliest paid date of the group', () => {
    const first = row('cs_test_a', {
      refundedMinor: BigInt(400),
      paidAt: null,
    })
    const second = row('in_1a', {
      refundedMinor: BigInt(0),
      paidAt: new Date('2026-11-12T20:41:00Z'),
    })

    const plan = planDonationDedupe([first, second], () => ({ canonicalId: 'pi_1a' }))

    expect(plan.groups[0].keeper).toEqual({
      refundedMinor: BigInt(400),
      paidAt: new Date('2026-11-12T20:41:00Z'),
    })
  })

  it('never deletes a row Stripe could not resolve', () => {
    const broken = row('in_missing')

    const plan = planDonationDedupe([broken], () => ({ canonicalId: null, error: '404' }))

    expect(plan.groups).toEqual([])
    expect(plan.unresolved).toEqual([{ row: broken, reason: '404' }])
  })

  it('groups a single row without deleting anything', () => {
    const invoice = row('in_1a')

    const plan = planDonationDedupe([invoice], () => ({ canonicalId: 'pi_1a' }))

    expect(plan.groups).toEqual([
      {
        canonicalId: 'pi_1a',
        keeperId: invoice.id,
        deleteIds: [],
        keeper: { refundedMinor: BigInt(0), paidAt: invoice.paidAt },
      },
    ])
  })
})
